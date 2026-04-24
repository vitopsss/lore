export interface CatalogSearchFilters {
  releaseDate?: string;
  genre?: string;
  country?: string;
  language?: string;
  service?: string;
}

export type CatalogSource = "all" | "google" | "open_library";

const GOOGLE_SERVICE_ALIASES = new Set([
  "google",
  "google books",
  "google_books",
  "googlebooks"
]);

const OPEN_LIBRARY_SERVICE_ALIASES = new Set([
  "open",
  "open library",
  "open_library",
  "openlibrary"
]);

export const normalizeCatalogLanguage = (value?: string) => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (normalized === "portuguese" || normalized === "portugues") {
    return "pt";
  }

  if (normalized === "english" || normalized === "ingles") {
    return "en";
  }

  if (normalized === "spanish" || normalized === "espanhol") {
    return "es";
  }

  return normalized.slice(0, 2) || null;
};

export const normalizeCatalogSource = (value?: string): CatalogSource => {
  if (!value) {
    return "all";
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "all";
  }

  if (GOOGLE_SERVICE_ALIASES.has(normalized)) {
    return "google";
  }

  if (OPEN_LIBRARY_SERVICE_ALIASES.has(normalized)) {
    return "open_library";
  }

  return "all";
};

export const buildCatalogSearchQuery = (
  query: string,
  filters: CatalogSearchFilters
) =>
  [
    query.trim(),
    filters.releaseDate?.trim(),
    filters.genre?.trim(),
    filters.country?.trim(),
    filters.language?.trim(),
    normalizeCatalogSource(filters.service) === "all" ? filters.service?.trim() : undefined
  ]
    .filter(Boolean)
    .join(" ")
    .trim() || "book";
