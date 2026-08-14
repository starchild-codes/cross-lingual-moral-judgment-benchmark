export const languageCodes = ["en", "hi", "bn", "ta", "es", "ja", "ar"] as const;
export type LanguageCode = (typeof languageCodes)[number];
export type NonEnglishLanguageCode = Exclude<LanguageCode, "en">;

export type LanguageMeta = {
  code: LanguageCode;
  name: string;
  nativeName: string;
  script: string;
  direction: "ltr" | "rtl";
  qaStatus: "final";
  qaReviewedAt?: string;
};

export const languages: Record<LanguageCode, LanguageMeta> = {
  en: { code: "en", name: "English", nativeName: "English", script: "Latin", direction: "ltr", qaStatus: "final" },
  hi: { code: "hi", name: "Hindi", nativeName: "हिन्दी", script: "Devanagari", direction: "ltr", qaStatus: "final" },
  bn: { code: "bn", name: "Bengali", nativeName: "বাংলা", script: "Bengali", direction: "ltr", qaStatus: "final" },
  ta: { code: "ta", name: "Tamil", nativeName: "தமிழ்", script: "Tamil", direction: "ltr", qaStatus: "final" },
  es: { code: "es", name: "Spanish", nativeName: "Español", script: "Latin", direction: "ltr", qaStatus: "final" },
  ja: { code: "ja", name: "Japanese", nativeName: "日本語", script: "Mixed", direction: "ltr", qaStatus: "final" },
  ar: {
    code: "ar",
    name: "Arabic",
    nativeName: "العربية",
    script: "Arabic",
    direction: "rtl",
    qaStatus: "final",
    qaReviewedAt: "2026-06-24"
  }
};

export const nonEnglishLanguageCodes = languageCodes.filter((code): code is NonEnglishLanguageCode => code !== "en");
