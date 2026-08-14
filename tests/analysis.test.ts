import { describe, expect, it } from "vitest";
import { framingEffect, reasoningEffect, referenceDivergence, type RatingRow } from "../lib/analysis";

describe("analysis", () => {
  it("compares evaluated models against gemini_pro on identical scenario and condition keys", () => {
    const rows: RatingRow[] = [
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "en_en", inputLang: "en", reasoningLang: "en", scenarioVersion: "en", rating: 6 },
      { modelKey: "gemini_pro", scenarioId: "S01", conditionId: "en_en", inputLang: "en", reasoningLang: "en", scenarioVersion: "en", rating: 4 },
      { modelKey: "gemini_pro", scenarioId: "S01", conditionId: "hi_translation_reason_en", inputLang: "hi", reasoningLang: "en", scenarioVersion: "translation", rating: 1 }
    ];

    expect(referenceDivergence(rows)).toEqual([
      expect.objectContaining({
        modelKey: "chatgpt",
        scenarioId: "S01",
        conditionId: "en_en",
        absoluteDifference: 2,
        modelRating: 6,
        referenceRating: 4
      })
    ]);
  });

  it("pairs framing effects within the same reasoning language", () => {
    const rows: RatingRow[] = [
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_translation_reason_en", inputLang: "hi", reasoningLang: "en", scenarioVersion: "translation", rating: 1 },
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_adapted_reason_en", inputLang: "hi", reasoningLang: "en", scenarioVersion: "adapted", rating: 3 },
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_translation_reason_hi", inputLang: "hi", reasoningLang: "hi", scenarioVersion: "translation", rating: 6 },
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_adapted_reason_hi", inputLang: "hi", reasoningLang: "hi", scenarioVersion: "adapted", rating: 5 }
    ];

    expect(framingEffect(rows, "hi")).toEqual(expect.objectContaining({ n: 2, meanDifference: 0.5 }));
  });

  it("pairs reasoning effects within the same scenario version", () => {
    const rows: RatingRow[] = [
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_translation_reason_en", inputLang: "hi", reasoningLang: "en", scenarioVersion: "translation", rating: 1 },
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_translation_reason_hi", inputLang: "hi", reasoningLang: "hi", scenarioVersion: "translation", rating: 2 },
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_adapted_reason_en", inputLang: "hi", reasoningLang: "en", scenarioVersion: "adapted", rating: 6 },
      { modelKey: "chatgpt", scenarioId: "S01", conditionId: "hi_adapted_reason_hi", inputLang: "hi", reasoningLang: "hi", scenarioVersion: "adapted", rating: 4 }
    ];

    expect(reasoningEffect(rows, "hi")).toEqual(expect.objectContaining({ n: 2, meanDifference: -0.5 }));
  });
});
