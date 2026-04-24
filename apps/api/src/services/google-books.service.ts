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

export interface GoogleBookVolume {
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

interface GoogleVolumeQueryOptions {
  query: string;
  filters?: CatalogSearchFilters;
  orderBy?: "relevance" | "newest";
  maxResults?: number;
}

interface SearchCacheEntry {
  books: BookInput[];
  expiresAt: number;
}

interface LocalizedVolumeLookup {
  googleId?: string;
  isbn?: string | null;
  title: string;
  author: string;
}

type SupportedCatalogLocale = "pt" | "en";

const SEARCH_CACHE_TTL_MS = 1000 * 60 * 10;
const searchCache = new Map<string, SearchCacheEntry>();
const FEATURED_QUERIES: Record<SupportedCatalogLocale, Record<FeaturedBooksMode, string[]>> = {
  en: {
    anticipated: [
      "subject:fiction",
      "subject:fantasy",
      "subject:young adult",
      "subject:science fiction",
      "subject:romance",
      "subject:bestsellers"
    ],
    popular: [
      "subject:fiction",
      "subject:romance",
      "subject:fantasy",
      "subject:thriller",
      "subject:mystery",
      "subject:young adult",
      "subject:bestsellers"
    ]
  },
  pt: {
    anticipated: [
      "subject:ficcao",
      "subject:fantasia",
      "subject:romance",
      "subject:ficcao cientifica",
      "subject:juvenil",
      "subject:bestsellers"
    ],
    popular: [
      "subject:ficcao",
      "subject:romance",
      "subject:fantasia",
      "subject:suspense",
      "subject:misterio",
      "subject:classicos",
      "subject:bestsellers"
    ]
  }
};

const normalizeLocale = (value?: string | null): SupportedCatalogLocale =>
  normalizeCatalogLanguage(value ?? undefined) === "en" ? "en" : "pt";

const buildLocalizedCatalogQuery = (query: string, filters: CatalogSearchFilters) => {
  const baseQuery = buildCatalogSearchQuery(query, filters);
  const locale = normalizeLocale(filters.language);

  if (!query.trim() || filters.country?.trim()) {
    return baseQuery;
  }

  const localeHint = locale === "pt" ? "Brasil" : "English";
  return `${baseQuery} ${localeHint}`.trim();
};

const getLocalePreferenceScore = (book: BookInput, language?: string | null) => {
  const locale = normalizeLocale(language);
  const normalizedBookLanguage = normalizeCatalogLanguage(book.language ?? undefined);
  let score = 0;

  if (normalizedBookLanguage === locale) {
    score += 28;
  }

  if (locale === "pt") {
    const normalizedPublisher = normalizeToken(book.publisher ?? "");

    if (normalizedPublisher.includes("brasil")) {
      score += 20;
    }
  }

  return score;
};

const mergeLocalizedBookVariant = (baseBook: BookInput, localizedVolume: GoogleBookVolume) => {
  const localizedBook = mapVolumeToBook(localizedVolume);

  return {
    ...baseBook,
    ...localizedBook,
    googleId: baseBook.googleId
  };
};

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
    language: volume.volumeInfo.language ?? null,
    publisher: volume.volumeInfo.publisher ?? null,
    amazonAffiliateLink: buildAmazonAffiliateLink(isbn)
  };
};

const ensureSuccess = async (response: Response) => {
  if (!response.ok) {
    throw new HttpError(
      502,
      "Falha ao consultar o catálogo do Google Books.",
      "google_books_unavailable",
      {
        status: response.status
      }
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
    score += 100;
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

const getSearchScore = (book: BookInput, query: string, language?: string | null) => {
  const normalizedQuery = normalizeToken(query);
  const normalizedTitle = normalizeToken(book.title);
  const normalizedAuthor = normalizeAuthor(book.author);

  let score = getBookQualityScore(book);
  score += getLocalePreferenceScore(book, language);

  if (!normalizedQuery) {
    return score;
  }

  if (normalizedTitle === normalizedQuery) {
    score += 120;
  } else if (normalizedTitle.startsWith(normalizedQuery)) {
    score += 70;
  } else if (normalizedTitle.includes(normalizedQuery)) {
    score += 35;
  }

  if (normalizedAuthor === normalizedQuery) {
    score += 150;
  } else if (normalizedAuthor.includes(normalizedQuery)) {
    score += 90;
  }

  return score;
};

const rankAndDedupeBooks = (query: string, books: BookInput[], language?: string | null) => {
  const uniqueBooks = new Map<string, { book: BookInput; score: number }>();

  books.forEach((book) => {
    const key = normalizeBookFingerprint(book);
    const score = getSearchScore(book, query, language);
    const current = uniqueBooks.get(key);

    if (!current || score > current.score) {
      uniqueBooks.set(key, { book, score });
    }
  });

  return [...uniqueBooks.values()]
    .sort((left, right) => {
      const leftHasCover = Boolean(left.book.coverUrl);
      const rightHasCover = Boolean(right.book.coverUrl);

      if (leftHasCover !== rightHasCover) {
        return Number(rightHasCover) - Number(leftHasCover);
      }

      return right.score - left.score;
    })
    .map((entry) => entry.book);
};

const curateSearchResults = (query: string, books: BookInput[], language?: string | null) =>
  collapseExactTitleMatches(query, rankAndDedupeBooks(query, books, language)).slice(0, 12);

const isGoogleBooksUnavailableError = (error: unknown) =>
  error instanceof HttpError && error.code === "google_books_unavailable";

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

const buildSearchCacheKey = (query: string, filters: CatalogSearchFilters) =>
  JSON.stringify({
    query: normalizeToken(query),
    releaseDate: filters.releaseDate?.trim().toLowerCase() ?? "",
    genre: normalizeToken(filters.genre ?? ""),
    country: normalizeToken(filters.country ?? ""),
    language: normalizeCatalogLanguage(filters.language) ?? "",
    service: normalizeCatalogSource(filters.service)
  });

const getCachedSearch = (cacheKey: string) => {
  const cachedEntry = searchCache.get(cacheKey);

  if (!cachedEntry) {
    return null;
  }

  if (cachedEntry.expiresAt <= Date.now()) {
    searchCache.delete(cacheKey);
    return null;
  }

  return cachedEntry.books;
};

const setCachedSearch = (cacheKey: string, books: BookInput[]) => {
  searchCache.set(cacheKey, {
    books,
    expiresAt: Date.now() + SEARCH_CACHE_TTL_MS
  });
};

const buildLocalizedLookupQueries = ({
  isbn,
  title,
  author
}: LocalizedVolumeLookup) => {
  const queries = new Set<string>();
  const normalizedIsbn = isbn?.trim();
  const primaryAuthor = author.split(/,| e | and /i)[0]?.trim();
  const normalizedTitle = title.trim();

  if (normalizedIsbn) {
    queries.add(`isbn:${normalizedIsbn}`);
  }

  if (normalizedTitle && primaryAuthor) {
    queries.add(`${normalizedTitle} ${primaryAuthor}`);
  }

  if (normalizedTitle) {
    queries.add(normalizedTitle);
  }

  return [...queries];
};

const scoreLocalizedVolumeMatch = (
  candidate: GoogleBookVolume,
  lookup: LocalizedVolumeLookup
) => {
  let score = 0;
  const candidateIsbn = extractIsbn(candidate);

  if (lookup.googleId && candidate.id === lookup.googleId) {
    score += 400;
  }

  if (lookup.isbn?.trim() && candidateIsbn?.trim() && lookup.isbn.trim() === candidateIsbn.trim()) {
    score += 260;
  }

  const lookupTitle = normalizeToken(lookup.title);
  const candidateTitle = normalizeToken(candidate.volumeInfo.title ?? "");

  if (lookupTitle && candidateTitle === lookupTitle) {
    score += 220;
  } else if (lookupTitle && candidateTitle.includes(lookupTitle)) {
    score += 120;
  }

  const lookupAuthor = normalizeAuthor(lookup.author);
  const candidateAuthor = normalizeAuthor(candidate.volumeInfo.authors?.join(", ") ?? "");

  if (lookupAuthor && candidateAuthor === lookupAuthor) {
    score += 120;
  } else if (lookupAuthor && candidateAuthor.includes(lookupAuthor)) {
    score += 60;
  }

  if (candidate.volumeInfo.description?.trim()) {
    score += 30;
  }

  return score;
};

const fetchGoogleVolumeDocuments = async ({
  query,
  filters = {},
  orderBy = "relevance",
  maxResults = 12
}: GoogleVolumeQueryOptions) => {
  const requestUrl = new URL(`${env.GOOGLE_BOOKS_BASE_URL}/volumes`);
  const normalizedLanguage = normalizeCatalogLanguage(filters.language);

  requestUrl.searchParams.set("q", buildLocalizedCatalogQuery(query, filters));
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

  return filteredItems;
};

const fetchGoogleVolumes = async (options: GoogleVolumeQueryOptions) => {
  const items = await fetchGoogleVolumeDocuments(options);
  return items.map(mapVolumeToBook);
};

export const findLocalizedGoogleVolume = async (
  lookup: LocalizedVolumeLookup,
  language?: string | null
) => {
  const normalizedLanguage = normalizeCatalogLanguage(language ?? undefined);

  if (!normalizedLanguage) {
    return null;
  }

  const queries = buildLocalizedLookupQueries(lookup);

  if (queries.length === 0) {
    return null;
  }

  const results = await Promise.allSettled(
    queries.map((query) =>
      fetchGoogleVolumeDocuments({
        query,
        filters: {
          language: normalizedLanguage
        },
        orderBy: "relevance",
        maxResults: 6
      })
    )
  );

  const candidates = results
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort(
      (left, right) =>
        scoreLocalizedVolumeMatch(right, lookup) - scoreLocalizedVolumeMatch(left, lookup)
    );

  return candidates[0] ?? null;
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
  try {
    const curatedGoogleBooks = curateSearchResults(
      query,
      await searchLiveGoogleBooks(query, filters),
      filters.language
    );

    if (curatedGoogleBooks.length > 0) {
      return curatedGoogleBooks;
    }
  } catch (error) {
    if (!isGoogleBooksUnavailableError(error)) {
      throw error;
    }
  }

  const curatedOpenLibraryBooks = curateSearchResults(
    query,
    await searchOpenLibraryBooks(query, filters),
    filters.language
  );

  if (curatedOpenLibraryBooks.length > 0) {
    return curatedOpenLibraryBooks;
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
  const cacheKey = buildSearchCacheKey(query, filters);
  const cachedBooks = getCachedSearch(cacheKey);

  if (cachedBooks) {
    return cachedBooks;
  }

  const source = normalizeCatalogSource(filters.service);
  let books: BookInput[];

  if (source === "google") {
    books = await searchGoogleBooks(query, filters);
  } else if (source === "open_library") {
    books = curateSearchResults(query, await searchOpenLibraryBooks(query, filters), filters.language);
  } else {
    books = await searchGoogleBooks(query, filters);
  }

  setCachedSearch(cacheKey, books);
  return books;
};

export type FeaturedBooksMode = "popular" | "anticipated";

export const getFeaturedBooks = async (
  language = "pt",
  mode: FeaturedBooksMode = "popular"
) => {
  const locale = normalizeLocale(language);
  const highlightQueries = FEATURED_QUERIES[locale][mode];

  const results = await Promise.allSettled(
    highlightQueries.map((query) =>
      fetchGoogleVolumes({
        query,
        filters: {
          language: locale
        },
        orderBy: "newest",
        maxResults: 18
      })
    )
  );

  const books = results.flatMap((result) =>
    result.status === "fulfilled" ? result.value : []
  );

  return rankAndDedupeBooks("", books, locale).slice(0, 12);
};

export const getGoogleBookById = async (
  googleId: string,
  preferredLanguage?: string | null
) => {
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
    const baseBook = mapVolumeToBook(payload);
    const normalizedLanguage = normalizeCatalogLanguage(preferredLanguage ?? undefined);

    if (!normalizedLanguage) {
      return baseBook;
    }

    const volumeLanguage = payload.volumeInfo.language?.trim().toLowerCase() ?? "";

    if (!volumeLanguage || volumeLanguage.startsWith(normalizedLanguage)) {
      return baseBook;
    }

    const localizedVolume = await findLocalizedGoogleVolume(
      {
        googleId,
        isbn: baseBook.isbn ?? null,
        title: baseBook.title,
        author: baseBook.author
      },
      normalizedLanguage
    );

    return localizedVolume ? mergeLocalizedBookVariant(baseBook, localizedVolume) : baseBook;
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
