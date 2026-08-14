import { languages, nonEnglishLanguageCodes, type LanguageCode } from "./languages";
import type { Condition } from "./schemas";

export function generateConditions(): Condition[] {
  const conditions: Condition[] = [
    {
      id: "en_en",
      inputLang: "en",
      reasoningLang: "en",
      scenarioVersion: "en",
      label: "English input + English reasoning"
    }
  ];

  for (const lang of nonEnglishLanguageCodes) {
    for (const scenarioVersion of ["translation", "adapted"] as const) {
      conditions.push({
        id: `${lang}_${scenarioVersion}_reason_en`,
        inputLang: lang,
        reasoningLang: "en",
        scenarioVersion,
        label: `${languages[lang].name} ${scenarioVersion} + English reasoning`
      });
      conditions.push({
        id: `${lang}_${scenarioVersion}_reason_${lang}`,
        inputLang: lang,
        reasoningLang: lang,
        scenarioVersion,
        label: `${languages[lang].name} ${scenarioVersion} + ${languages[lang].name} reasoning`
      });
    }
  }

  return conditions;
}

export function assertValidPromptPair(inputLang: LanguageCode, reasoningLang: LanguageCode) {
  if (inputLang === "en" && reasoningLang !== "en") {
    throw new Error("English input cannot be paired with non-English reasoning in this study design.");
  }
  if (inputLang !== "en" && reasoningLang !== "en" && reasoningLang !== inputLang) {
    throw new Error("Non-English reasoning must be English or the input scenario language.");
  }
}
