import * as Localization from "expo-localization";
import i18n from "i18next";
import { I18nManager } from "react-native";
import { initReactI18next } from "react-i18next";
import { LanguagePreference, SupportedLanguage } from "@/models/photo";
import { normalizeLanguagePreference, resolveSupportedLanguageTag, rtlLanguages } from "@/i18n/languages";
import ar from "@/i18n/locales/ar.json";
import de from "@/i18n/locales/de.json";
import en from "@/i18n/locales/en.json";
import es from "@/i18n/locales/es.json";
import fr from "@/i18n/locales/fr.json";
import hi from "@/i18n/locales/hi.json";
import id from "@/i18n/locales/id.json";
import it from "@/i18n/locales/it.json";
import ja from "@/i18n/locales/ja.json";
import ptBR from "@/i18n/locales/pt-BR.json";

export const resources = {
  en: { translation: en },
  es: { translation: es },
  "pt-BR": { translation: ptBR },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  id: { translation: id },
  hi: { translation: hi },
  ar: { translation: ar },
  ja: { translation: ja }
} as const;

export function getDeviceLanguage(): SupportedLanguage {
  const [locale] = Localization.getLocales();
  return resolveSupportedLanguageTag(locale?.languageTag ?? locale?.languageCode);
}

export function resolveLanguagePreference(preference: LanguagePreference): SupportedLanguage {
  const normalized = normalizeLanguagePreference(preference);
  return normalized === "system" ? getDeviceLanguage() : normalized;
}

export async function applyLanguagePreference(preference: LanguagePreference) {
  const language = resolveLanguagePreference(preference);
  if (i18n.language !== language) {
    await i18n.changeLanguage(language);
  }

  const shouldUseRTL = rtlLanguages.has(language);
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL !== shouldUseRTL) {
    I18nManager.forceRTL(shouldUseRTL);
  }
}

void i18n.use(initReactI18next).init({
  resources,
  lng: getDeviceLanguage(),
  fallbackLng: "en",
  supportedLngs: Object.keys(resources),
  cleanCode: false,
  returnNull: false,
  interpolation: {
    escapeValue: false
  },
  react: {
    useSuspense: false
  }
});

export default i18n;
