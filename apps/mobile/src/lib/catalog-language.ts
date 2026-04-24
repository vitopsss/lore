import { getCurrentLanguage } from "../i18n";

const supportedLanguages = new Set(["pt", "en", "es", "fr"]);

export const getPreferredCatalogLanguage = () => {
  const locale = getCurrentLanguage() || Intl.DateTimeFormat().resolvedOptions().locale || "pt-BR";
  const language = locale.split("-")[0]?.toLowerCase() ?? "pt";

  return supportedLanguages.has(language) ? language : "pt";
};
