import { LanguagePreference, SupportedLanguage } from "@/models/photo";

export const supportedLanguages: SupportedLanguage[] = ["en", "es", "pt-BR", "fr", "de", "it", "id", "hi", "ar", "ja"];

export const rtlLanguages = new Set<SupportedLanguage>(["ar"]);

export type LanguageOption = {
  value: LanguagePreference;
  labelKey: string;
  nativeName: string;
};

export const languageOptions: LanguageOption[] = [
  { value: "system", labelKey: "languages.system", nativeName: "System default" },
  { value: "en", labelKey: "languages.en", nativeName: "English" },
  { value: "es", labelKey: "languages.es", nativeName: "Español" },
  { value: "pt-BR", labelKey: "languages.ptBR", nativeName: "Português (Brasil)" },
  { value: "fr", labelKey: "languages.fr", nativeName: "Français" },
  { value: "de", labelKey: "languages.de", nativeName: "Deutsch" },
  { value: "it", labelKey: "languages.it", nativeName: "Italiano" },
  { value: "id", labelKey: "languages.id", nativeName: "Bahasa Indonesia" },
  { value: "hi", labelKey: "languages.hi", nativeName: "हिन्दी" },
  { value: "ar", labelKey: "languages.ar", nativeName: "العربية" },
  { value: "ja", labelKey: "languages.ja", nativeName: "日本語" }
];

export function isSupportedLanguage(value: unknown): value is SupportedLanguage {
  return typeof value === "string" && supportedLanguages.includes(value as SupportedLanguage);
}

export function normalizeLanguagePreference(value: unknown): LanguagePreference {
  if (value === "system") return "system";
  if (value === "pt") return "pt-BR";
  if (isSupportedLanguage(value)) return value;
  return "system";
}

export function resolveSupportedLanguageTag(tag?: string | null): SupportedLanguage {
  if (!tag) return "en";
  const normalized = tag.replace("_", "-");
  const lower = normalized.toLowerCase();
  if (lower.startsWith("pt")) return "pt-BR";
  const base = lower.split("-")[0];
  if (isSupportedLanguage(base)) return base;
  return "en";
}
