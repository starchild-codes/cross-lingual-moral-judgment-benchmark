import { evaluatedModelKeys, type EvaluatedModelKey, type ModelKey, type ScenarioVersion } from "./schemas";
import { nonEnglishLanguageCodes, type NonEnglishLanguageCode } from "./languages";
import { pairedDifferenceSummary } from "./stats";

export type RatingRow = {
  modelKey: ModelKey;
  scenarioId: string;
  conditionId: string;
  inputLang: string;
  reasoningLang: string;
  scenarioVersion: ScenarioVersion;
  mft_foundation?: string;
  rating: number | null;
};

function ratingMap(rows: RatingRow[]) {
  return new Map(rows.filter((row) => row.rating !== null).map((row) => [`${row.modelKey}|${row.scenarioId}|${row.conditionId}`, row.rating as number]));
}

function summarizePairs(
  rows: RatingRow[],
  aPredicate: (row: RatingRow) => boolean,
  bPredicate: (row: RatingRow) => boolean,
  pairKey: (row: RatingRow) => string
) {
  const aRows = rows.filter((row) => row.rating !== null && aPredicate(row));
  const bRows = rows.filter((row) => row.rating !== null && bPredicate(row));
  const bByKey = new Map(bRows.map((row) => [pairKey(row), row.rating as number]));
  const pairs = aRows.flatMap((row) => {
    const b = bByKey.get(pairKey(row));
    return b === undefined ? [] : [{ a: row.rating as number, b }];
  });
  return pairedDifferenceSummary(pairs);
}

export function languageEffect(df: RatingRow[], lang: NonEnglishLanguageCode) {
  return {
    effect: "language",
    lang,
    comparison: `${lang} translation with English reasoning - English baseline`,
    ...summarizePairs(
      df,
      (row) => row.inputLang === lang && row.scenarioVersion === "translation" && row.reasoningLang === "en",
      (row) => row.inputLang === "en" && row.scenarioVersion === "en" && row.reasoningLang === "en",
      (row) => `${row.modelKey}|${row.scenarioId}|${row.mft_foundation ?? ""}`
    )
  };
}

export function framingEffect(df: RatingRow[], lang: NonEnglishLanguageCode) {
  return {
    effect: "framing",
    lang,
    comparison: `${lang} adapted - ${lang} translation, same reasoning language`,
    ...summarizePairs(
      df,
      (row) => row.inputLang === lang && row.scenarioVersion === "adapted",
      (row) => row.inputLang === lang && row.scenarioVersion === "translation",
      (row) => `${row.modelKey}|${row.scenarioId}|${row.reasoningLang}|${row.mft_foundation ?? ""}`
    )
  };
}

export function reasoningEffect(df: RatingRow[], lang: NonEnglishLanguageCode) {
  return {
    effect: "reasoning",
    lang,
    comparison: `${lang} reasoning - English reasoning, same ${lang} input`,
    ...summarizePairs(
      df,
      (row) => row.inputLang === lang && row.reasoningLang === lang,
      (row) => row.inputLang === lang && row.reasoningLang === "en",
      (row) => `${row.modelKey}|${row.scenarioId}|${row.scenarioVersion}|${row.mft_foundation ?? ""}`
    )
  };
}

export function foundationBreakdown(df: RatingRow[]) {
  const foundations = [...new Set(df.map((row) => row.mft_foundation).filter(Boolean))] as string[];
  return foundations.flatMap((foundation) => {
    const subset = df.filter((row) => row.mft_foundation === foundation);
    return nonEnglishLanguageCodes.flatMap((lang) => [
      { foundation, ...languageEffect(subset, lang) },
      { foundation, ...framingEffect(subset, lang) },
      { foundation, ...reasoningEffect(subset, lang) }
    ]);
  });
}

export function modelComparison(df: RatingRow[]) {
  return evaluatedModelKeys.flatMap((modelKey) => {
    const subset = df.filter((row) => row.modelKey === modelKey);
    return nonEnglishLanguageCodes.flatMap((lang) => [
      { modelKey, ...languageEffect(subset, lang) },
      { modelKey, ...framingEffect(subset, lang) },
      { modelKey, ...reasoningEffect(subset, lang) }
    ]);
  });
}

export function referenceDivergence(df: RatingRow[]) {
  const map = ratingMap(df);
  const rows = df.filter((row): row is RatingRow & { modelKey: EvaluatedModelKey; rating: number } => {
    return evaluatedModelKeys.includes(row.modelKey as EvaluatedModelKey) && row.rating !== null;
  });

  return rows.flatMap((row) => {
    const reference = map.get(`gemini_pro|${row.scenarioId}|${row.conditionId}`);
    if (reference === undefined) return [];
    return {
      modelKey: row.modelKey,
      scenarioId: row.scenarioId,
      conditionId: row.conditionId,
      inputLang: row.inputLang,
      reasoningLang: row.reasoningLang,
      scenarioVersion: row.scenarioVersion,
      absoluteDifference: Math.abs(row.rating - reference),
      modelRating: row.rating,
      referenceRating: reference
    };
  });
}

export function computeAnalysis(df: RatingRow[]) {
  return {
    languageEffects: nonEnglishLanguageCodes.map((lang) => languageEffect(df, lang)),
    framingEffects: nonEnglishLanguageCodes.map((lang) => framingEffect(df, lang)),
    reasoningEffects: nonEnglishLanguageCodes.map((lang) => reasoningEffect(df, lang)),
    foundationBreakdown: foundationBreakdown(df),
    modelComparison: modelComparison(df),
    referenceDivergence: referenceDivergence(df)
  };
}
