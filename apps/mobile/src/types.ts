export type ActivityType = "lendo" | "lido" | "abandonado" | "quero_ler";

export type CardThemeName = "classic" | "noir" | "tropical" | "wrapped";

export type FeedScope = "community" | "self";

export interface CatalogSearchFilters {
  releaseDate?: string;
  genre?: string;
  country?: string;
  language?: string;
  service?: string;
}

export interface AppUser {
  id: string;
  username: string;
  premiumStatus: boolean;
  bio: string | null;
  avatar: string | null;
  currentStreak: number;
  lastReadDate: string | null;
}

export interface BookSearchResult {
  googleId: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  isbn?: string | null;
  pageCount?: number | null;
  categories: string[];
  amazonAffiliateLink?: string | null;
}

export interface BookDetailReview {
  activityId: string;
  userId: string;
  username: string;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  createdAt: string;
  cardTheme: CardThemeName;
}

export interface ViewerBookActivity {
  activityId: string;
  type: ActivityType;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  createdAt: string;
  cardTheme: CardThemeName;
  showExcerpt: boolean;
}

export interface BookDetailPayload {
  book: BookSearchResult & {
    description: string | null;
    publishedDate: string | null;
    publisher: string | null;
    language: string | null;
    externalAverageRating: number | null;
    externalRatingsCount: number | null;
  };
  ratings: {
    communityAverageRating: number | null;
    communityRatingsCount: number;
    communityReviewsCount: number;
    communityLogsCount: number;
    externalAverageRating: number | null;
    externalRatingsCount: number | null;
  };
  reviews: BookDetailReview[];
  similarBooks: BookSearchResult[];
  viewerActivity: ViewerBookActivity | null;
}

export interface ShareCardResult {
  width: number;
  height: number;
  theme: CardThemeName;
  base64: string;
  cloudinaryUrl: string | null;
  sharePath: string;
}

export interface StreakSnapshot {
  currentStreak: number;
  lastReadDate: string | null;
}

export interface ActivityCreationResult {
  activity: {
    id: string;
    userId: string;
    bookId: string;
    type: ActivityType;
    rating: number | null;
    reviewText: string | null;
    readAt: string | null;
    cardTheme: CardThemeName;
    showExcerpt: boolean;
    createdAt: string;
  };
  book: BookSearchResult & { id: string };
  streak: StreakSnapshot;
  shareCard: ShareCardResult;
}

export interface FeedItem {
  activityId: string;
  type: ActivityType;
  rating: number | null;
  reviewText: string | null;
  readAt: string | null;
  cardTheme: CardThemeName;
  createdAt: string;
  userId: string;
  username: string;
  bookId: string;
  googleId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  amazonAffiliateLink: string | null;
}

export interface StatsPayload {
  userId: string;
  summary: {
    booksRead: number;
    pagesRead: number;
    averageDaysToFinish: number;
  };
  statuses: Record<string, number>;
  topGenres: Array<{
    genre: string;
    total: number;
  }>;
  advanced?: {
    averageRating: number;
    completionRate: number;
    monthlyPace: number;
  };
}
