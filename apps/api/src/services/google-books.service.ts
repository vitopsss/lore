import { HttpError } from "../lib/http-error";
import {
  buildCatalogSearchQuery,
  normalizeCatalogLanguage,
  normalizeCatalogSource
} from "../lib/catalog-search";
import type { BookInput } from "../types/domain";
import type { CatalogSearchFilters } from "../lib/catalog-search";

import { env } from "../config/env";
import { findDemoBookByGoogleId, searchDemoBooks } from "../db/memory-store";
import { buildAmazonAffiliateLink } from "./amazon-affiliate.service";
import { getOpenLibraryBookById, searchOpenLibraryBooks } from "./open-library.service";

interface GoogleBooksResponse {
  items?: GoogleBookVolume[];
}

interface GoogleBookVolume {
  id: string;
  volumeInfo: {
    title?: string;
    authors?: string[];
    language?: string;
    publishedDate?: string;
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

interface GoogleVolumeQueryOptions {
  query: string;
  filters?: CatalogSearchFilters;
  orderBy?: "relevance" | "newest";
  maxResults?: number;
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

const extractIsbn = (volume: GoogleBookVolume) => {
  return (
    volume.volumeInfo.industryIdentifiers?.find((identifier) => identifier.type === "ISBN_13")
      ?.identifier ??
    volume.volumeInfo.industryIdentifiers?.find((identifier) => identifier.type === "ISBN_10")
      ?.identifier ??
    null
  );
};

const mapVolumeToBook = (volume: GoogleBookVolume): BookInput => {
  const isbn = extractIsbn(volume);

  return {
    googleId: volume.id,
    title: volume.volumeInfo.title ?? "Título indisponível",
    author: volume.volumeInfo.authors?.join(", ") ?? "Autor desconhecido",
    coverUrl: normalizeCoverUrl(
      volume.volumeInfo.imageLinks?.extraLarge ??
        volume.volumeInfo.imageLinks?.large ??
        volume.volumeInfo.imageLinks?.medium ??
        volume.volumeInfo.imageLinks?.thumbnail ??
        volume.volumeInfo.imageLinks?.smallThumbnail
    ),
    isbn,
    pageCount: volume.volumeInfo.pageCount ?? null,
    categories: volume.volumeInfo.categories ?? [],
    amazonAffiliateLink: buildAmazonAffiliateLink(isbn)
  };
};

const ensureSuccess = async (response: Response) => {
  if (!response.ok) {
    throw new HttpError(
      502,
      "Falha ao consultar o catálogo do Google Books.",
      "google_books_unavailable"
    );
  }
};

const normalizeBookFingerprint = (book: BookInput) => {
  const isbnKey = book.isbn?.trim();

  if (isbnKey) {
    return `isbn:${isbnKey}`;
  }

  return `title:${normalizeToken(book.title)}::author:${normalizeAuthor(book.author)}`;
};

const normalizeToken = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(volume|vol|edicao|edição|livro|book|roman|classicos?|classics?)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeAuthor = (value: string) => {
  const [primaryAuthor = value] = value.split(/[,;/&]| e /i);
  return normalizeToken(primaryAuthor);
};

const getBookQualityScore = (book: BookInput) => {
  let score = 0;

  if (book.coverUrl) {
    score += 30;
  }

  if (book.isbn) {
    score += 18;
  }

  if (book.pageCount) {
    score += 10;
  }

  score += Math.min(book.categories?.length ?? 0, 3) * 4;

  return score;
};

const getSearchScore = (book: BookInput, query: string) => {
  const normalizedQuery = normalizeToken(query);
  const normalizedTitle = normalizeToken(book.title);
  const normalizedAuthor = normalizeAuthor(book.author);

  let score = getBookQualityScore(book);

  if (!normalizedQuery) {
    return score;
  }

  if (normalizedTitle === normalizedQuery) {
    score += 140;
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 90;
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 55;
  }

  if (normalizedAuthor.includes(normalizedQuery)) {
    score += 25;
  }

  return score;
};

const rankAndDedupeBooks = (query: string, books: BookInput[]) => {
  const uniqueBooks = new Map<string, { book: BookInput; score: number }>();

  books.forEach((book) => {
    const key = normalizeBookFingerprint(book);
    const score = getSearchScore(book, query);
    const current = uniqueBooks.get(key);

    if (!current || score > current.score) {
      uniqueBooks.set(key, { book, score });
    }
  });

  return [...uniqueBooks.values()]
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.book);
};

const collapseExactTitleMatches = (query: string, books: BookInput[]) => {
  const normalizedQuery = normalizeToken(query);

  if (!normalizedQuery) {
    return books;
  }

  const collapsed = new Map<string, BookInput>();
  const remaining: BookInput[] = [];

  books.forEach((book) => {
    const normalizedTitle = normalizeToken(book.title);

    if (
      normalizedTitle === normalizedQuery ||
      normalizedTitle.startsWith(`${normalizedQuery} `) ||
      normalizedTitle.includes(` ${normalizedQuery}`)
    ) {
      if (!collapsed.has(normalizedTitle)) {
        collapsed.set(normalizedTitle, book);
      }

      return;
    }

    remaining.push(book);
  });

  return [...collapsed.values(), ...remaining];
};

const fetchGoogleVolumes = async ({
  query,
  filters = {},
  orderBy = "relevance",
  maxResults = 12
}: GoogleVolumeQueryOptions) => {
  const requestUrl = new URL(`${env.GOOGLE_BOOKS_BASE_URL}/volumes`);
  const normalizedLanguage = normalizeCatalogLanguage(filters.language);

  requestUrl.searchParams.set("q", buildCatalogSearchQuery(query, filters));
  if (normalizedLanguage) {
    requestUrl.searchParams.set("langRestrict", normalizedLanguage);
  }
  requestUrl.searchParams.set("printType", "books");
  requestUrl.searchParams.set("maxResults", String(maxResults));
  requestUrl.searchParams.set("orderBy", orderBy);

  const response = await fetch(requestUrl);
  await ensureSuccess(response);
  const payload = (await response.json()) as GoogleBooksResponse;

  const filteredItems = normalizedLanguage
    ? (payload.items ?? []).filter((item) => {
        const volumeLanguage = item.volumeInfo.language?.trim().toLowerCase();
        return !volumeLanguage || volumeLanguage.startsWith(normalizedLanguage);
      })
    : payload.items ?? [];

  return filteredItems.map(mapVolumeToBook);
};

const searchLiveGoogleBooks = async (
  query: string,
  filters: CatalogSearchFilters = {}
) => {
  return fetchGoogleVolumes({
    query,
    filters,
    orderBy: query.trim() ? "relevance" : "newest"
  });
};

export const searchGoogleBooks = async (
  query: string,
  filters: CatalogSearchFilters = {}
) => {
  const [googleResult, openLibraryResult] = await Promise.allSettled([
    searchLiveGoogleBooks(query, filters),
    searchOpenLibraryBooks(query, filters)
  ]);

  const mergedBooks = rankAndDedupeBooks(query, [
    ...(googleResult.status === "fulfilled" ? googleResult.value : []),
    ...(openLibraryResult.status === "fulfilled" ? openLibraryResult.value : [])
  ]);

  const curatedBooks = collapseExactTitleMatches(query, mergedBooks).slice(0, 12);

  if (curatedBooks.length > 0) {
    return curatedBooks;
  }

  if (env.ALLOW_DEMO_BOOK_FALLBACK) {
    return searchDemoBooks(query);
  }

  return [];
};

export const searchCatalogBooks = async (
  query: string,
  filters: CatalogSearchFilters = {}
) => {
  const source = normalizeCatalogSource(filters.service);

  if (source === "google") {
    return collapseExactTitleMatches(
      query,
      rankAndDedupeBooks(query, await searchLiveGoogleBooks(query, filters))
    ).slice(0, 12);
  }

  if (source === "open_library") {
    return collapseExactTitleMatches(
      query,
      rankAndDedupeBooks(query, await searchOpenLibraryBooks(query, filters))
    ).slice(0, 12);
  }

  return searchGoogleBooks(query, filters);
};

export type FeaturedBooksMode = "popular" | "anticipated";

export const getFeaturedBooks = async (
  language = "pt",
  mode: FeaturedBooksMode = "popular"
) => {
  const highlightQueries =
    mode === "anticipated"
      ? [
          "subject:fiction",
          "subject:fantasy",
          "subject:young adult",
          "subject:science fiction",
          "subject:romance"
        ]
      : [
          "subject:fiction",
          "subject:romance",
          "subject:fantasy",
          "subject:thriller",
          "subject:mystery",
          "subject:young adult"
        ];

  const results = await Promise.allSettled(
    highlightQueries.map((query) =>
      fetchGoogleVolumes({
        query,
        filters: {
          language
        },
        orderBy: "newest",
        maxResults: 12
      })
    )
  );

  const books = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  return rankAndDedupeBooks("", books).slice(0, 16);
};

export const getGoogleBookById = async (googleId: string) => {
  if (googleId.startsWith("ol:")) {
    const openLibraryBook = await getOpenLibraryBookById(googleId);

    if (openLibraryBook) {
      return openLibraryBook;
    }
  }

  if (env.DATA_PROVIDER === "memory" && env.ALLOW_DEMO_BOOK_FALLBACK) {
    const demoBook = findDemoBookByGoogleId(googleId);
    if (demoBook) {
      return demoBook;
    }
  }

  try {
    const response = await fetch(`${env.GOOGLE_BOOKS_BASE_URL}/volumes/${googleId}`);
    await ensureSuccess(response);
    const payload = (await response.json()) as GoogleBookVolume;
    return mapVolumeToBook(payload);
  } catch {
    if (env.ALLOW_DEMO_BOOK_FALLBACK) {
      const demoBook = findDemoBookByGoogleId(googleId);
      if (demoBook) {
        return demoBook;
      }
    }

    throw new HttpError(404, "Livro não encontrado no catálogo.", "book_not_found");
  }
};
