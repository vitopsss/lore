import { env } from "../config/env";
import { memoryStore } from "../db/memory-store";
import { pool } from "../db/pool";
import { HttpError } from "../lib/http-error";
import type { BookInput } from "../types/domain";

import { buildAmazonAffiliateLink } from "./amazon-affiliate.service";
import { getGoogleBookById, searchCatalogBooks } from "./google-books.service";
import { getOpenLibraryBookById, isOpenLibraryBookId } from "./open-library.service";

interface GoogleBookDetailResponse {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    description?: string;
    language?: string;
    publishedDate?: string;
    publisher?: string;
    averageRating?: number;
    ratingsCount?: number;
    imageLinks?: {
      extraLarge?: string;
      large?: string;
      medium?: string;
      thumbnail?: string;
      smallThumbnail?: string;
    };
    industryIdentifiers?: Array<{
      type: string;
      identifier: string;
    }>;
    pageCount?: number;
    categories?: string[];
  };
}

interface OpenLibraryEditionResponse {
  key?: string;
  title?: string;
  by_statement?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  number_of_pages?: number;
  subjects?: Array<string | { name?: string }>;
  description?: string | { value?: string };
  publish_date?: string;
  publishers?: string[];
  works?: Array<{
    key?: string;
  }>;
  authors?: Array<{
    author?: {
      key?: string;
    };
  }>;
}

interface OpenLibraryWorkResponse {
  description?: string | { value?: string };
  subjects?: string[];
  authors?: Array<{
    author?: {
      key?: string;
    };
  }>;
}

interface OpenLibraryAuthorResponse {
  name?: string;
}

interface BookCommunityReviewRow {
  activityId: string;
  userId: string;
  username: string;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  createdAt: string;
  cardTheme: string;
}

interface BookCommunitySummaryRow {
  communityAverageRating: number | null;
  communityRatingsCount: number;
  communityReviewsCount: number;
  communityLogsCount: number;
}

interface CatalogBookDetail extends BookInput {
  categories: string[];
  description: string | null;
  publishedDate: string | null;
  publisher: string | null;
  language: string | null;
  externalAverageRating: number | null;
  externalRatingsCount: number | null;
}

export interface BookDetailPayload {
  book: CatalogBookDetail;
  ratings: BookCommunitySummaryRow & {
    externalAverageRating: number | null;
    externalRatingsCount: number | null;
  };
  reviews: BookCommunityReviewRow[];
  similarBooks: BookInput[];
}

const normalizeCoverUrl = (coverUrl?: string | null) => {
  if (!coverUrl) {
    return null;
  }

  return coverUrl
    .replace("http://", "https://")
    .replace("&edge=curl", "")
    .replace("zoom=1", "zoom=2");
};

const normalizeIdentifier = (value: string) => value.replace(/[^0-9X]/gi, "").toUpperCase();

const extractPreferredIsbn = (identifiers?: string[]) => {
  if (!identifiers?.length) {
    return null;
  }

  const normalizedIdentifiers = identifiers
    .map(normalizeIdentifier)
    .filter((identifier) => /^\d{10}(\d{3})?$/.test(identifier));

  return (
    normalizedIdentifiers.find((identifier) => identifier.length === 13) ??
    normalizedIdentifiers[0] ??
    null
  );
};

const extractGoogleIsbn = (payload: GoogleBookDetailResponse) =>
  payload.volumeInfo.industryIdentifiers?.find((identifier) => identifier.type === "ISBN_13")
    ?.identifier ??
  payload.volumeInfo.industryIdentifiers?.find((identifier) => identifier.type === "ISBN_10")
    ?.identifier ??
  null;

const decodeHtmlEntities = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const sanitizeSynopsis = (value?: string | null) => {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return decodeHtmlEntities(normalized)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
};

const normalizeOpenLibraryDescription = (
  value?: string | { value?: string } | null
) => {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return sanitizeSynopsis(value);
  }

  return sanitizeSynopsis(value.value ?? null);
};

const normalizeOpenLibraryPath = (value: string) => {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  if (normalizedValue.startsWith("/")) {
    return normalizedValue;
  }

  if (/^OL\d+M$/i.test(normalizedValue)) {
    return `/books/${normalizedValue}`;
  }

  if (/^OL\d+W$/i.test(normalizedValue)) {
    return `/works/${normalizedValue}`;
  }

  return `/${normalizedValue}`;
};

const normalizeSubjects = (subjects?: Array<string | { name?: string }>) =>
  (subjects ?? [])
    .map((subject) => (typeof subject === "string" ? subject : subject.name ?? ""))
    .map((subject) => subject.trim())
    .filter(Boolean);

const buildOpenLibraryHeaders = () => {
  const contactEmail = env.OPEN_LIBRARY_CONTACT_EMAIL?.trim();

  if (!contactEmail) {
    return undefined;
  }

  return {
    email: contactEmail,
    "User-Agent": `${env.APP_NAME} (${contactEmail})`
  };
};

const fetchOpenLibraryJson = async <T>(path: string): Promise<T | null> => {
  const requestUrl = new URL(`${path}.json`, env.OPEN_LIBRARY_BASE_URL);
  const response = await fetch(requestUrl, {
    headers: buildOpenLibraryHeaders()
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new HttpError(
      502,
      "Falha ao consultar o catálogo da Open Library.",
      "open_library_unavailable"
    );
  }

  return (await response.json()) as T;
};

const resolveOpenLibraryAuthor = async (
  edition: OpenLibraryEditionResponse,
  work: OpenLibraryWorkResponse | null,
  fallbackAuthor: string
) => {
  if (fallbackAuthor.trim() && fallbackAuthor !== "Autor desconhecido") {
    return fallbackAuthor;
  }

  const authorKey =
    edition.authors?.[0]?.author?.key ?? work?.authors?.[0]?.author?.key ?? null;

  if (!authorKey) {
    return fallbackAuthor;
  }

  const author = await fetchOpenLibraryJson<OpenLibraryAuthorResponse>(authorKey);
  return author?.name?.trim() || fallbackAuthor;
};

const loadGoogleBookDetail = async (googleId: string): Promise<CatalogBookDetail> => {
  const response = await fetch(`${env.GOOGLE_BOOKS_BASE_URL}/volumes/${googleId}`);

  if (!response.ok) {
    const fallbackBook = await getGoogleBookById(googleId);

    return {
      ...fallbackBook,
      coverUrl: fallbackBook.coverUrl ?? null,
      isbn: fallbackBook.isbn ?? null,
      pageCount: fallbackBook.pageCount ?? null,
      categories: fallbackBook.categories ?? [],
      amazonAffiliateLink: fallbackBook.amazonAffiliateLink ?? null,
      description: null,
      publishedDate: null,
      publisher: null,
      language: null,
      externalAverageRating: null,
      externalRatingsCount: null
    };
  }

  const payload = (await response.json()) as GoogleBookDetailResponse;
  const isbn = extractGoogleIsbn(payload);

  return {
    googleId: payload.id,
    title: payload.volumeInfo.title?.trim() || "Título indisponível",
    author: payload.volumeInfo.authors?.join(", ") ?? "Autor desconhecido",
    coverUrl: normalizeCoverUrl(
      payload.volumeInfo.imageLinks?.extraLarge ??
        payload.volumeInfo.imageLinks?.large ??
        payload.volumeInfo.imageLinks?.medium ??
        payload.volumeInfo.imageLinks?.thumbnail ??
        payload.volumeInfo.imageLinks?.smallThumbnail
    ),
    isbn,
    pageCount: payload.volumeInfo.pageCount ?? null,
    categories: payload.volumeInfo.categories ?? [],
    amazonAffiliateLink: buildAmazonAffiliateLink(isbn),
    description: sanitizeSynopsis(payload.volumeInfo.description),
    publishedDate: payload.volumeInfo.publishedDate ?? null,
    publisher: payload.volumeInfo.publisher ?? null,
    language: payload.volumeInfo.language ?? null,
    externalAverageRating: payload.volumeInfo.averageRating ?? null,
    externalRatingsCount: payload.volumeInfo.ratingsCount ?? null
  };
};

const loadOpenLibraryBookDetail = async (bookId: string): Promise<CatalogBookDetail> => {
  const basicBook = await getOpenLibraryBookById(bookId);

  if (!basicBook) {
    throw new HttpError(404, "Livro não encontrado no catálogo.", "book_not_found");
  }

  const normalizedPath = normalizeOpenLibraryPath(bookId.slice("ol:".length));

  if (!normalizedPath) {
    throw new HttpError(404, "Livro não encontrado no catálogo.", "book_not_found");
  }

  const edition = await fetchOpenLibraryJson<OpenLibraryEditionResponse>(normalizedPath);

  if (!edition) {
    throw new HttpError(404, "Livro não encontrado no catálogo.", "book_not_found");
  }

  const workKey = edition.works?.[0]?.key ?? null;
  const work = workKey
    ? await fetchOpenLibraryJson<OpenLibraryWorkResponse>(workKey)
    : null;
  const author = await resolveOpenLibraryAuthor(edition, work, basicBook.author);
  const isbn =
    extractPreferredIsbn(edition.isbn_13) ?? extractPreferredIsbn(edition.isbn_10);
  const editionSubjects = normalizeSubjects(edition.subjects).slice(0, 6);

  return {
    googleId: basicBook.googleId,
    title: basicBook.title,
    author,
    coverUrl: basicBook.coverUrl ?? null,
    isbn: isbn ?? basicBook.isbn ?? null,
    pageCount: edition.number_of_pages ?? basicBook.pageCount ?? null,
    categories: editionSubjects.length > 0 ? editionSubjects : (work?.subjects ?? []).slice(0, 6),
    amazonAffiliateLink: buildAmazonAffiliateLink(isbn ?? basicBook.isbn ?? null),
    description:
      normalizeOpenLibraryDescription(edition.description) ??
      normalizeOpenLibraryDescription(work?.description ?? null),
    publishedDate: edition.publish_date ?? null,
    publisher: edition.publishers?.[0] ?? null,
    language: null,
    externalAverageRating: null,
    externalRatingsCount: null
  };
};

const dedupeBooks = (books: BookInput[], currentGoogleId: string) => {
  const uniqueBooks = new Map<string, BookInput>();

  books.forEach((book) => {
    if (!book.googleId || book.googleId === currentGoogleId) {
      return;
    }

    if (!uniqueBooks.has(book.googleId)) {
      uniqueBooks.set(book.googleId, book);
    }
  });

  return [...uniqueBooks.values()];
};

const loadSimilarBooks = async (book: CatalogBookDetail) => {
  const requests: Array<Promise<BookInput[]>> = [];
  const language = book.language?.trim() || undefined;
  const primaryCategory = book.categories[0]?.trim();
  const authorQuery = book.author.split(/,| e | and /i)[0]?.trim();

  if (primaryCategory) {
    requests.push(
      searchCatalogBooks("", {
        genre: primaryCategory,
        language
      })
    );
  }

  if (authorQuery) {
    requests.push(
      searchCatalogBooks(authorQuery, {
        language
      })
    );
  }

  if (requests.length === 0) {
    return [];
  }

  const results = await Promise.allSettled(requests);

  return dedupeBooks(
    results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
    book.googleId
  ).slice(0, 12);
};

const loadBookCommunityDetails = async (
  googleId: string
): Promise<BookCommunitySummaryRow & { reviews: BookCommunityReviewRow[] }> => {
  if (env.DATA_PROVIDER === "memory") {
    return memoryStore.getBookCommunityDetails(googleId);
  }

  const [summaryResult, reviewsResult] = await Promise.all([
    pool.query<BookCommunitySummaryRow>(
      `
        select
          round(avg(a.rating)::numeric, 2)::float8 as "communityAverageRating",
          count(*) filter (where a.rating is not null)::int as "communityRatingsCount",
          count(*) filter (
            where nullif(trim(coalesce(a.review_text, '')), '') is not null
          )::int as "communityReviewsCount",
          count(*)::int as "communityLogsCount"
        from activities a
        join books b on b.id = a.book_id
        where b.google_id = $1
      `,
      [googleId]
    ),
    pool.query<BookCommunityReviewRow>(
      `
        select
          a.id as "activityId",
          u.id as "userId",
          u.username,
          a.rating,
          a.review_text as "reviewText",
          a.read_at as "readAt",
          a.created_at as "createdAt",
          a.card_theme as "cardTheme"
        from activities a
        join users u on u.id = a.user_id
        join books b on b.id = a.book_id
        where b.google_id = $1
          and (
            a.rating is not null
            or nullif(trim(coalesce(a.review_text, '')), '') is not null
          )
        order by a.created_at desc
        limit 12
      `,
      [googleId]
    )
  ]);

  return {
    communityAverageRating: summaryResult.rows[0]?.communityAverageRating ?? null,
    communityRatingsCount: summaryResult.rows[0]?.communityRatingsCount ?? 0,
    communityReviewsCount: summaryResult.rows[0]?.communityReviewsCount ?? 0,
    communityLogsCount: summaryResult.rows[0]?.communityLogsCount ?? 0,
    reviews: reviewsResult.rows
  };
};

export const getBookDetail = async (googleId: string): Promise<BookDetailPayload> => {
  const book = isOpenLibraryBookId(googleId)
    ? await loadOpenLibraryBookDetail(googleId)
    : await loadGoogleBookDetail(googleId);

  const [community, similarBooks] = await Promise.all([
    loadBookCommunityDetails(googleId),
    loadSimilarBooks(book)
  ]);

  return {
    book,
    ratings: {
      communityAverageRating: community.communityAverageRating,
      communityRatingsCount: community.communityRatingsCount,
      communityReviewsCount: community.communityReviewsCount,
      communityLogsCount: community.communityLogsCount,
      externalAverageRating: book.externalAverageRating,
      externalRatingsCount: book.externalRatingsCount
    },
    reviews: community.reviews,
    similarBooks
  };
};
