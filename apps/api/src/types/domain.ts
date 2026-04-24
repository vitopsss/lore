export type ActivityType = "lendo" | "lido" | "abandonado" | "quero_ler";

export type CardThemeName = "classic" | "noir" | "tropical" | "wrapped";

export interface StreakSnapshot {
  currentStreak: number;
  lastReadDate: string | null;
}

export interface CurrentUser extends StreakSnapshot {
  id: string;
  username: string;
  premiumStatus: boolean;
}

export interface UserSummary extends CurrentUser {
  bio: string | null;
  avatar: string | null;
}

export interface BookInput {
  googleId: string;
  title: string;
  author: string;
  coverUrl?: string | null;
  isbn?: string | null;
  pageCount?: number | null;
  categories?: string[];
  amazonAffiliateLink?: string | null;
}

export interface StoredBook {
  id: string;
  googleId: string;
  title: string;
  author: string;
  coverUrl: string | null;
  isbn: string | null;
  pageCount: number | null;
  categories: string[];
  amazonAffiliateLink: string | null;
}
