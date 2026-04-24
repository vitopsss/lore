import type { CardThemeName } from "./types";
import { CARD_THEME_META } from "./theme";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "") ?? "http://localhost:3333";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || null;
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || null;

export const HAS_SUPABASE_AUTH_CONFIG = Boolean(
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
);

export const CARD_THEMES: Array<{
  key: CardThemeName;
  label: string;
  premium: boolean;
}> = [
  { key: "classic", label: CARD_THEME_META.classic.label, premium: false },
  { key: "noir", label: CARD_THEME_META.noir.label, premium: true },
  { key: "tropical", label: CARD_THEME_META.tropical.label, premium: true },
  { key: "wrapped", label: CARD_THEME_META.wrapped.label, premium: true }
];
