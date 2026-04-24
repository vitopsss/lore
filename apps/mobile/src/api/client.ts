import { API_BASE_URL } from "../config";
import { getPreferredCatalogLanguage } from "../lib/catalog-language";
import type {
  ActivityCreationResult,
  ActivityType,
  AppUser,
  BookDetailPayload,
  BookSearchResult,
  CatalogSearchFilters,
  CardThemeName,
  FeedItem,
  FeedScope,
  StatsPayload
} from "../types";

const normalizeUser = (
  user: Partial<AppUser> & Pick<AppUser, "id" | "username" | "premiumStatus">
): AppUser => ({
  id: user.id,
  username: user.username,
  premiumStatus: user.premiumStatus,
  bio: user.bio ?? null,
  avatar: user.avatar ?? null,
  currentStreak: user.currentStreak ?? 0,
  lastReadDate: user.lastReadDate ?? null
});

const request = async <T>(
  path: string,
  viewerId?: string,
  options?: RequestInit
): Promise<T> => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string> | undefined)
  };

  if (viewerId) {
    headers["x-user-id"] = viewerId;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers
  });

  const rawBody = await response.text();
  const isJsonResponse = response.headers
    .get("content-type")
    ?.toLowerCase()
    .includes("application/json");

  let payload: {
    data?: T;
    error?: {
      message?: string;
    };
  } | null = null;

  if (rawBody) {
    if (isJsonResponse) {
      payload = JSON.parse(rawBody) as {
        data?: T;
        error?: {
          message?: string;
        };
      };
    } else {
      try {
        payload = JSON.parse(rawBody) as {
          data?: T;
          error?: {
            message?: string;
          };
        };
      } catch {
        payload = null;
      }
    }
  }

  if (!response.ok) {
    if (payload?.error?.message) {
      throw new Error(payload.error.message);
    }

    throw new Error(
      `A API respondeu fora do padrão em ${path} (${response.status}). Reinicie a API do backend.`
    );
  }

  if (!payload || !("data" in payload)) {
    throw new Error(
      `A API respondeu com um formato inválido em ${path}. Verifique ${API_BASE_URL} e reinicie a API.`
    );
  }

  return payload.data as T;
};

export const getShareCardUrl = (activityId: string) =>
  `${API_BASE_URL}/api/share/${encodeURIComponent(activityId)}`;

export const searchBooks = (
  query: string,
  viewerId: string,
  filters: CatalogSearchFilters = {}
) => {
  const effectiveFilters = filters.language?.trim()
    ? filters
    : {
        ...filters,
        language: getPreferredCatalogLanguage()
      };
  const searchParams = new URLSearchParams();

  if (query.trim()) {
    searchParams.set("q", query.trim());
  }

  Object.entries(effectiveFilters).forEach(([key, value]) => {
    if (value?.trim()) {
      searchParams.set(key, value.trim());
    }
  });

  const queryString = searchParams.toString();

  return request<BookSearchResult[]>(
    `/search${queryString ? `?${queryString}` : ""}`,
    viewerId
  );
};

export const loadUsers = async () => (await request<AppUser[]>("/users")).map(normalizeUser);

export const createUser = (payload: { username: string }) =>
  request<AppUser>("/users", undefined, {
    method: "POST",
    body: JSON.stringify(payload)
  }).then(normalizeUser);

export const loadFeaturedBooks = (
  viewerId: string,
  language = getPreferredCatalogLanguage(),
  mode: "popular" | "anticipated" = "popular"
) =>
  request<BookSearchResult[]>(
    `/discover/highlights?language=${encodeURIComponent(language)}&mode=${encodeURIComponent(mode)}`,
    viewerId
  );

export const loadBookDetail = (viewerId: string, googleId: string) =>
  request<BookDetailPayload>(
    `/books/detail?googleId=${encodeURIComponent(googleId)}`,
    viewerId
  );

export const createActivity = (
  viewerId: string,
  payload: {
    book: BookSearchResult;
    type: ActivityType;
    rating: number | null;
    cardTheme: CardThemeName;
    showExcerpt?: boolean;
    reviewText?: string;
    readAt?: string;
  }
) =>
  request<ActivityCreationResult>("/activity", viewerId, {
    method: "POST",
    body: JSON.stringify({
      userId: viewerId,
      type: payload.type,
      rating: payload.rating,
      cardTheme: payload.cardTheme,
      showExcerpt: payload.showExcerpt,
      reviewText: payload.reviewText,
      readAt: payload.readAt,
      book: payload.book
    })
  });

export const loadFeed = (viewerId: string, scope: FeedScope) =>
  request<FeedItem[]>(`/feed?scope=${scope}`, viewerId);

export const loadStats = (userId: string, viewerId: string, advanced: boolean) =>
  request<StatsPayload>(
    `/stats/${userId}?mode=${advanced ? "advanced" : "basic"}`,
    viewerId
  );
