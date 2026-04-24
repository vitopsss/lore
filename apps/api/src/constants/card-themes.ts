import type { CardThemeName } from "../types/domain";

export const CARD_THEMES: Record<
  CardThemeName,
  {
    backgroundStart: string;
    backgroundEnd: string;
    panel: string;
    accent: string;
    text: string;
    exclusive: boolean;
  }
> = {
  classic: {
    backgroundStart: "#0f172a",
    backgroundEnd: "#1d4ed8",
    panel: "rgba(15, 23, 42, 0.32)",
    accent: "#facc15",
    text: "#f8fafc",
    exclusive: false
  },
  noir: {
    backgroundStart: "#050505",
    backgroundEnd: "#404040",
    panel: "rgba(255, 255, 255, 0.08)",
    accent: "#f5f5f5",
    text: "#fafafa",
    exclusive: true
  },
  tropical: {
    backgroundStart: "#134e4a",
    backgroundEnd: "#f97316",
    panel: "rgba(17, 24, 39, 0.18)",
    accent: "#fde68a",
    text: "#fff7ed",
    exclusive: true
  },
  wrapped: {
    backgroundStart: "#3f0d12",
    backgroundEnd: "#a71d31",
    panel: "rgba(255, 255, 255, 0.1)",
    accent: "#fbbf24",
    text: "#fff8eb",
    exclusive: true
  }
};

export const DEFAULT_CARD_THEME: CardThemeName = "classic";

export const EXCLUSIVE_CARD_THEMES = new Set<CardThemeName>(
  Object.entries(CARD_THEMES)
    .filter(([, theme]) => theme.exclusive)
    .map(([name]) => name as CardThemeName)
);
