import { describe, expect, it } from "vitest";
import { generateConditions } from "../lib/conditions";
import { nonEnglishLanguageCodes } from "../lib/languages";

describe("conditions", () => {
  it("generates exactly 25 condition batches", () => {
    expect(generateConditions()).toHaveLength(25);
  });

  it("includes EN/EN baseline exactly once", () => {
    const baseline = generateConditions().filter((condition) => condition.inputLang === "en" && condition.reasoningLang === "en");
    expect(baseline).toHaveLength(1);
    expect(baseline[0].scenarioVersion).toBe("en");
  });

  it("does not generate English input with non-English reasoning", () => {
    expect(generateConditions().some((condition) => condition.inputLang === "en" && condition.reasoningLang !== "en")).toBe(false);
  });

  it("generates translation/adapted by English/native reasoning for each non-English language", () => {
    const conditions = generateConditions();
    for (const lang of nonEnglishLanguageCodes) {
      expect(conditions).toEqual(expect.arrayContaining([
        expect.objectContaining({ inputLang: lang, scenarioVersion: "translation", reasoningLang: "en" }),
        expect.objectContaining({ inputLang: lang, scenarioVersion: "translation", reasoningLang: lang }),
        expect.objectContaining({ inputLang: lang, scenarioVersion: "adapted", reasoningLang: "en" }),
        expect.objectContaining({ inputLang: lang, scenarioVersion: "adapted", reasoningLang: lang })
      ]));
    }
  });
});
