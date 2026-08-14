import { parse } from "csv-parse/sync";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { nonEnglishLanguageCodes, type LanguageCode } from "./languages";
import { scenarioColumns, scenarioSchema, sourceScenarioColumns, type Condition, type Scenario } from "./schemas";

export const scenarioCsvPath = path.join(process.cwd(), "data", "scenarios.csv");
export const extensionScenarioCsvPath = path.join(process.cwd(), "data", "scenarios_extension.csv");

export async function loadScenarios(filePath = scenarioCsvPath): Promise<Scenario[]> {
  const csv = await readFile(filePath, "utf8");
  const rows = parse(csv, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    record_delimiter: ["\r\n", "\n", "\r"]
  }) as unknown[];

  validateScenarioColumns(csv);
  const parsed = rows
    .map(normalizeScenarioRow)
    .filter((row): row is Scenario => row !== null)
    .map((row) => scenarioSchema.parse(row));
  validateScenarioCorpus(parsed);
  return parsed;
}

export function validateScenarioColumns(csv: string) {
  const [header] = csv.split(/\r?\n/, 1);
  const columns = (parse(`${header}\n`, { columns: false, trim: true, bom: true, record_delimiter: ["\r\n", "\n", "\r"] })[0] as string[]).map((column) =>
    column.replace(/^\uFEFF/, "")
  );
  const expected = scenarioColumns.map(String);
  const source = [...sourceScenarioColumns];
  const isCanonical = columns.length === expected.length && columns.every((column, index) => column === expected[index]);
  const isSource = columns.length === source.length && columns.every((column, index) => column === source[index]);
  if (!isCanonical && !isSource) {
    throw new Error(`Scenario CSV columns must match the canonical schema or the supported source schema. Canonical: ${expected.join(", ")}`);
  }
}

function normalizeScenarioRow(row: unknown): Record<string, string> | null {
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  const rawId = String(record.scenario_id ?? record.scenarios_id ?? "").trim();
  if (!rawId) return null;
  if (!/^\d+$/.test(rawId) && !/^S\d{2}$/.test(rawId)) return null;
  const scenarioId = rawId.startsWith("S") ? rawId : `S${rawId.padStart(2, "0")}`;
  return {
    scenario_id: scenarioId,
    mft_category: String(record.mft_category ?? "").trim(),
    mft_foundation: String(record.mft_foundation ?? "").trim(),
    moral_structure_en: String(record.moral_structure_en ?? `Not provided in source corpus for ${scenarioId}.`).trim(),
    text_en: String(record.text_en ?? "").trim(),
    text_hi_b: String(record.text_hi_b ?? "").trim(),
    text_hi_c: String(record.text_hi_c ?? "").trim(),
    text_bn_b: String(record.text_bn_b ?? "").trim(),
    text_bn_c: String(record.text_bn_c ?? "").trim(),
    text_ta_b: String(record.text_ta_b ?? "").trim(),
    text_ta_c: String(record.text_ta_c ?? "").trim(),
    text_es_b: String(record.text_es_b ?? "").trim(),
    text_es_c: String(record.text_es_c ?? "").trim(),
    text_ja_b: String(record.text_ja_b ?? "").trim(),
    text_ja_c: String(record.text_ja_c ?? "").trim(),
    text_ar_b: String(record.text_ar_b ?? "").trim(),
    text_ar_c: String(record.text_ar_c ?? "").trim()
  };
}

export function validateScenarioCorpus(scenarios: Scenario[]) {
  if (scenarios.length !== 25) {
    throw new Error(`Scenario CSV must contain exactly 25 rows; found ${scenarios.length}.`);
  }

  const nonLatinChecks: Record<Exclude<LanguageCode, "en" | "es">, RegExp> = {
    hi: /[\u0900-\u097F]/,
    bn: /[\u0980-\u09FF]/,
    ta: /[\u0B80-\u0BFF]/,
    ja: /[\u3040-\u30FF\u3400-\u9FFF]/,
    ar: /[\u0600-\u06FF]/
  };

  for (const scenario of scenarios) {
    for (const lang of nonEnglishLanguageCodes) {
      if (lang === "es") continue;
      const b = scenario[`text_${lang}_b` as keyof Scenario] as string;
      const c = scenario[`text_${lang}_c` as keyof Scenario] as string;
      if (lang === "ar" && (!b || !c)) continue;
      if (!nonLatinChecks[lang].test(b) || !nonLatinChecks[lang].test(c)) {
        throw new Error(`Scenario ${scenario.scenario_id} does not contain expected script text for ${lang}.`);
      }
    }
  }
}

export function getScenarioText(scenario: Scenario, condition: Condition) {
  if (condition.scenarioVersion === "en") return scenario.text_en;
  const suffix = condition.scenarioVersion === "translation" ? "b" : "c";
  return scenario[`text_${condition.inputLang}_${suffix}` as keyof Scenario] as string;
}

export function qualitativeSubsample(scenarios: Scenario[]) {
  const seen = new Set<string>();
  return scenarios.filter((scenario) => {
    if (seen.has(scenario.mft_category)) return false;
    seen.add(scenario.mft_category);
    return true;
  });
}

export async function loadScenarioMetadata() {
  const scenarios = await loadScenarios();
  try {
    return [...scenarios, ...(await loadScenarios(extensionScenarioCsvPath))];
  } catch {
    return scenarios;
  }
}
