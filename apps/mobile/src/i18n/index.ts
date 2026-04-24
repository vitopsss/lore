import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";

const resources = {
  "pt-BR": { translation: ptBR },
  en: { translation: en }
};

const getDeviceLanguage = (): string => {
  const locales = Localization.getLocales();
  const deviceLocale = locales[0]?.languageCode ?? "en";

  if (deviceLocale === "pt") {
    return "pt-BR";
  }

  return "en";
};

i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  },
  compatibilityJSON: "v4"
});

export const useTranslation = i18n.t.bind(i18n);
export const changeLanguage = i18n.changeLanguage.bind(i18n);
export const getCurrentLanguage = () => i18n.language;

export default i18n;