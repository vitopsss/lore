import { HttpError } from "../lib/http-error";
import { buildCatalogSearchQuery } from "../lib/catalog-search";
import type { BookInput } from "../types/domain";
import type { CatalogSearchFilters } from "../lib/catalog-search";

import { env } from "../config/env";
import { buildAmazonAffiliateLink } from "./amazon-affiliate.service";

interface OpenLibrarySearchResponse {
  docs?: OpenLibrarySearchDoc[];
}

interface OpenLibrarySearchDoc {
  key?: string;
  title?: string;
  author_name?: string[];
  edition_key?: string[];
  isbn?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  subject?: string[];
}

interface OpenLibraryBookResponse {
  key?: string;
  title?: string;
  by_statement?: string;
  isbn_13?: string[];
  isbn_10?: string[];
  covers?: number[];
  number_of_pages?: number;
  subjects?: Array<string | { name?: string }>;
}

const OPEN_LIBRARY_PREFIX = "ol:";

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

const toOpenLibraryExternalId = (path: string) => `${OPEN_LIBRARY_PREFIX}${path}`;

const isValidIsbn = (value: string) => /^\d{10}(\d{3})?$/.test(value);

const normalizeIdentifier = (value: string) => value.replace(/[^0-9X]/gi, "").toUpperCase();

const extractPreferredIsbn = (identifiers?: string[]) => {
  if (!identifiers?.length) {
    return null;
  }

  const normalizedIdentifiers = identifiers
    .map(normalizeIdentifier)
    .filter(isValidIsbn);

  return (
    normalizedIdentifiers.find((identifier) => identifier.length === 13) ??
    normalizedIdentifiers[0] ??
    null
  );
};

const buildOpenLibraryCoverUrl = ({
  editionKey,
  coverId,
  isbn
}: {
  editionKey?: string | null;
  coverId?: number | null;
  isbn?: string | null;
}) => {
  if (editionKey) {
    return `https://covers.openlibrary.org/b/olid/${editionKey}-L.jpg?default=false`;
  }

  if (isbn) {
    return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`;
  }

  if (coverId) {
    return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`;
  }

  return null;
};

const normalizeSubjects = (subjects?: Array<string | { name?: string }>) =>
  (subjects ?? [])
    .map((subject) => (typeof subject === "string" ? subject : subject.name ?? ""))
    .map((subject) => subject.trim())
    .filter(Boolean);

const buildHeaders = () => {
  const contactEmail = env.OPEN_LIBRARY_CONTACT_EMAIL?.trim();

  if (!contactEmail) {
    return undefined;
  }

  return {
    email: contactEmail,
    "User-Agent": `${env.APP_NAME} (${contactEmail})`
  };
};

const resolveSearchPath = (doc: OpenLibrarySearchDoc) => {
  const editionKey = doc.edition_key?.find(Boolean);

  if (editionKey) {
    return normalizeOpenLibraryPath(editionKey);
  }

  if (doc.key) {
    return normalizeOpenLibraryPath(doc.key);
  }

  return null;
};

const mapSearchDocToBook = (doc: OpenLibrarySearchDoc): BookInput | null => {
  const path = resolveSearchPath(doc);
  const title = doc.title?.trim();

  if (!path || !title) {
    return null;
  }

  const editionKey = doc.edition_key?.find(Boolean) ?? null;
  const isbn = extractPreferredIsbn(doc.isbn);

  return {
    googleId: toOpenLibraryExternalId(path),
    title,
    author: doc.author_name?.[0]?.trim() || "Autor desconhecido",
    coverUrl: buildOpenLibraryCoverUrl({
      editionKey,
      coverId: doc.cover_i ?? null,
      isbn
    }),
    isbn,
    pageCount: doc.number_of_pages_median ?? null,
    categories: (doc.subject ?? []).slice(0, 4),
    amazonAffiliateLink: buildAmazonAffiliateLink(isbn)
  };
};

const ensureSuccess = async (response: Response) => {
  if (!response.ok) {
    throw new HttpError(
      502,
      "Falha ao consultar o catálogo da Open Library.",
      "open_library_unavailable"
    );
  }
};

export const isOpenLibraryBookId = (bookId: string) => bookId.startsWith(OPEN_LIBRARY_PREFIX);

export const searchOpenLibraryBooks = async (
  query: string,
  filters: CatalogSearchFilters = {}
) => {
  const requestUrl = new URL("/search.json", env.OPEN_LIBRARY_BASE_URL);
  requestUrl.searchParams.set("q", buildCatalogSearchQuery(query, filters));
  requestUrl.searchParams.set("limit", "12");
  requestUrl.searchParams.set(
    "fields",
    "key,title,author_name,edition_key,isbn,cover_i,number_of_pages_median,subject"
  );
  if (filters.genre?.trim()) {
    requestUrl.searchParams.set("subject", filters.genre.trim());
  }
  if (filters.country?.trim()) {
    requestUrl.searchParams.set("place", filters.country.trim());
  }
  if (filters.releaseDate?.trim()) {
    requestUrl.searchParams.set("first_publish_year", filters.releaseDate.trim());
  }

  const response = await fetch(requestUrl, {
    headers: buildHeaders()
  });

  await ensureSuccess(response);

  const payload = (await response.json()) as OpenLibrarySearchResponse;

  return (payload.docs ?? [])
    .map(mapSearchDocToBook)
    .filter((book): book is BookInput => Boolean(book));
};

export const getOpenLibraryBookById = async (bookId: string): Promise<BookInput | null> => {
  if (!isOpenLibraryBookId(bookId)) {
    return null;
  }

  const normalizedPath = normalizeOpenLibraryPath(bookId.slice(OPEN_LIBRARY_PREFIX.length));

  if (!normalizedPath) {
    return null;
  }

  const requestUrl = new URL(`${normalizedPath}.json`, env.OPEN_LIBRARY_BASE_URL);
  const response = await fetch(requestUrl, {
    headers: buildHeaders()
  });

  if (response.status === 404) {
    return null;
  }

  await ensureSuccess(response);

  const payload = (await response.json()) as OpenLibraryBookResponse;
  const editionKey = payload.key?.split("/").pop() ?? null;
  const isbn =
    extractPreferredIsbn(payload.isbn_13) ?? extractPreferredIsbn(payload.isbn_10);

  return {
    googleId: bookId,
    title: payload.title?.trim() || "Título indisponível",
    author: payload.by_statement?.trim() || "Autor desconhecido",
    coverUrl: buildOpenLibraryCoverUrl({
      editionKey,
      coverId: payload.covers?.[0] ?? null,
      isbn
    }),
    isbn,
    pageCount: payload.number_of_pages ?? null,
    categories: normalizeSubjects(payload.subjects).slice(0, 4),
    amazonAffiliateLink: buildAmazonAffiliateLink(isbn)
  };
};
