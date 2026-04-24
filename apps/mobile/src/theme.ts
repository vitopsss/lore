import type { CardThemeName } from "./types";

export const BRAND_NAME = "MARGEM";

export const COLORS = {
  background: "#0f1117",
  backgroundAlt: "#151923",
  backgroundRaised: "#1c2230",
  panel: "rgba(22, 26, 36, 0.94)",
  panelStrong: "#121722",
  panelMuted: "#202736",
  field: "#0d121a",
  border: "rgba(238, 230, 214, 0.08)",
  borderStrong: "rgba(197, 139, 91, 0.28)",
  text: "#f5f1e8",
  textSoft: "#d8d2c8",
  textMuted: "#98a1b2",
  accent: "#c58b5b",
  accentSoft: "#e0b484",
  accentCool: "#7ca7b9",
  success: "#7ab685",
  successTint: "#122218",
  warning: "#d8a05f",
  warningTint: "#261b12",
  danger: "#d2736b",
  dangerTint: "#2a1618"
} as const;

export const CARD_THEME_META: Record<
  CardThemeName,
  {
    accent: string;
    label: string;
  }
> = {
  classic: {
    accent: COLORS.accent,
    label: "Editorial"
  },
  noir: {
    accent: "#9aa2af",
    label: "Grafite"
  },
  tropical: {
    accent: COLORS.warning,
    label: "Solar"
  },
  wrapped: {
    accent: COLORS.accentCool,
    label: "Atlas"
  }
};

export const getCardThemeMeta = (theme: CardThemeName) => CARD_THEME_META[theme];
