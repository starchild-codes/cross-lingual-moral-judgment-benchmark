import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { scenarioColumns, sourceScenarioColumns } from "../lib/schemas";
import { loadScenarios, scenarioCsvPath } from "../lib/scenarios";
import { languages } from "../lib/languages";

describe("scenario CSV", () => {
  it("has a supported source or canonical header", async () => {
    const csv = await readFile(scenarioCsvPath, "utf8");
    const header = csv.split(/\r?\n/)[0].replace(/^\uFEFF/, "").split(",");
    expect([scenarioColumns, [...sourceScenarioColumns]]).toContainEqual(header);
  });

  it("normalizes to 25 canonical rows and loads UTF-8 non-Latin scripts", async () => {
    const scenarios = await loadScenarios();
    expect(scenarios).toHaveLength(25);
    expect(scenarios[0].scenario_id).toBe("S01");
    expect(scenarios[0].text_hi_b).toMatch(/[\u0900-\u097F]/);
    expect(scenarios[0].text_bn_b).toMatch(/[\u0980-\u09FF]/);
    expect(scenarios[0].text_ta_b).toMatch(/[\u0B80-\u0BFF]/);
    expect(scenarios[0].text_ja_b).toMatch(/[\u3040-\u30FF\u3400-\u9FFF]/);
    expect(scenarios[0].text_ar_b).toMatch(/[\u0600-\u06FF]/);
  });

  it("records Arabic native-speaker QA as complete", () => {
    expect(languages.ar.qaStatus).toBe("final");
    expect(languages.ar.qaReviewedAt).toBe("2026-06-24");
  });
});
