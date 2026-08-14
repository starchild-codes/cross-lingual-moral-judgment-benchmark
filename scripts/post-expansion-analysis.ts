import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateConditions } from "../lib/conditions";
import { nonEnglishLanguageCodes } from "../lib/languages";
import { evaluatedModelKeys, modelKeys } from "../lib/schemas";

type Row = Record<string, string>;
type EffectType = "language" | "framing" | "reasoning";
type EffectRow = {
  effect_type: EffectType;
  language: string;
  model_key: string;
  mft_foundation: string;
  mean_diff: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  p_value: number | null;
  cohens_d: number | null;
  n: number;
};

const originalRunId = "full_1782215308316_vrq93w";
const extensionRunId = "extension_full_1782729062659_xqetbf";
const processedDir = path.join(process.cwd(), "results", "processed");
const analysisDir = path.join(processedDir, "analysis");
const figureDataDir = path.join(process.cwd(), "results", "figures", "data");

const sources = [
  path.join(processedDir, `${originalRunId}.ratings.csv`),
  path.join(processedDir, `${originalRunId}.qualitative.csv`),
  path.join(processedDir, `${extensionRunId}.ratings.csv`),
  path.join(processedDir, `${extensionRunId}.qualitative.csv`)
];

async function main() {
  await Promise.all([mkdir(analysisDir, { recursive: true }), mkdir(figureDataDir, { recursive: true })]);
  const rows = (await Promise.all(sources.map(readCsv))).flat().map(addResponseId);
  const ratings = rows.filter((row) => row.taskType === "rating");
  const qualitative = rows.filter((row) => row.taskType === "qualitative");
  const evaluatedRatings = ratings.filter((row) => evaluatedModelKeys.includes(row.modelKey as never));

  await writeFile(path.join(processedDir, "full_merged.csv"), toCsv(rows), "utf8");

  const validation = validate(rows, ratings, qualitative, evaluatedRatings);
  await writeFile(path.join(analysisDir, "validation_report.txt"), validation.text, "utf8");
  await writeFile(path.join(analysisDir, "validation_report.json"), JSON.stringify(validation.json, null, 2), "utf8");

  const primaryRows = ratings.filter((row) => evaluatedModelKeys.includes(row.modelKey as never));
  const languageEffects = effectTable(primaryRows, "language");
  const framingEffects = effectTable(primaryRows, "framing");
  const reasoningEffects = effectTable(primaryRows, "reasoning");
  const foundation = foundationBreakdown(primaryRows);
  const modelComparison = modelComparisonTable(primaryRows);
  const divergence = referenceDivergence(ratings);

  await Promise.all([
    writeFile(path.join(analysisDir, "language_effects.csv"), toCsv(languageEffects), "utf8"),
    writeFile(path.join(analysisDir, "framing_effects.csv"), toCsv(framingEffects), "utf8"),
    writeFile(path.join(analysisDir, "reasoning_effects.csv"), toCsv(reasoningEffects), "utf8"),
    writeFile(path.join(analysisDir, "foundation_breakdown.csv"), toCsv(foundation), "utf8"),
    writeFile(path.join(analysisDir, "model_comparison.csv"), toCsv(modelComparison), "utf8"),
    writeFile(path.join(analysisDir, "reference_divergence.csv"), toCsv(divergence), "utf8"),
    writeFigureData(primaryRows, divergence)
  ]);

  console.log(validation.text);
}

async function readCsv(file: string): Promise<Row[]> {
  const csv = await readFile(file, "utf8");
  return parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Row[];
}

function addResponseId(row: Row): Row {
  return {
    response_id: [row.runId, row.modelKey, row.scenarioId, row.conditionId, row.taskType].join("__"),
    ...row
  };
}

function validate(rows: Row[], ratings: Row[], qualitative: Row[], evaluatedRatings: Row[]) {
  const conditions = generateConditions().map((condition) => condition.id);
  const report: string[] = [];
  const scenarioIds = [...new Set(rows.map((row) => row.scenarioId))].sort();
  const qualitativeScenarios = [...new Set(qualitative.map((row) => row.scenarioId))].sort();
  const nullEvaluated = evaluatedRatings.filter((row) => !row.parsedRating);
  const gaps: string[] = [];

  for (const scenarioId of scenarioIds) {
    for (const modelKey of modelKeys) {
      const present = new Set(ratings.filter((row) => row.scenarioId === scenarioId && row.modelKey === modelKey).map((row) => row.conditionId));
      for (const conditionId of conditions) {
        if (!present.has(conditionId)) gaps.push(`${scenarioId}/${modelKey}/${conditionId}`);
      }
    }
  }

  const byTask = groupCount(rows, "taskType");
  const byModel = groupCount(rows, "modelKey");
  const byScenario = groupCount(rows, "scenarioId");
  const notes = [
    "Expected rating rows by design: 50 scenarios x 25 conditions x 4 models = 5,000 total ratings.",
    "The prompt's 7,500 rating-row total is arithmetically inconsistent: Gemini Pro contributes 1,250 reference rows, not 3,750.",
    `Qualitative scenarios present: ${qualitativeScenarios.join(", ")}.`,
    "Qualitative rows are present for 10 designated qualitative targets, not for all 50 scenario IDs."
  ];

  report.push("Post-expansion validation report");
  report.push(`Total rows: ${rows.length}`);
  report.push(`Rating rows: ${ratings.length}`);
  report.push(`Qualitative rows: ${qualitative.length}`);
  report.push(`Evaluated-model rating rows: ${evaluatedRatings.length}`);
  report.push(`Reference rating rows: ${ratings.filter((row) => row.modelKey === "gemini_pro").length}`);
  report.push(`Null evaluated-model ratings: ${nullEvaluated.length}`);
  report.push(`Scenario IDs: ${scenarioIds.length} (${scenarioIds[0]}-${scenarioIds.at(-1)})`);
  report.push(`Condition coverage gaps: ${gaps.length}`);
  report.push("");
  report.push("Notes:");
  report.push(...notes.map((note) => `- ${note}`));
  report.push("");
  report.push("Rows by task type:");
  report.push(JSON.stringify(byTask, null, 2));
  report.push("Rows by model:");
  report.push(JSON.stringify(byModel, null, 2));
  report.push("Rows by scenario:");
  report.push(JSON.stringify(byScenario, null, 2));
  if (gaps.length) report.push(`Gaps:\n${gaps.join("\n")}`);

  return {
    text: `${report.join("\n")}\n`,
    json: {
      totalRows: rows.length,
      ratingRows: ratings.length,
      qualitativeRows: qualitative.length,
      evaluatedRatingRows: evaluatedRatings.length,
      referenceRatingRows: ratings.filter((row) => row.modelKey === "gemini_pro").length,
      nullEvaluatedRatings: nullEvaluated.length,
      scenarioCount: scenarioIds.length,
      qualitativeScenarioIds: qualitativeScenarios,
      conditionCoverageGaps: gaps,
      rowsByTaskType: byTask,
      rowsByModel: byModel,
      rowsByScenario: byScenario,
      notes
    }
  };
}

function effectTable(rows: Row[], effectType: EffectType): EffectRow[] {
  const output: EffectRow[] = [];
  for (const modelKey of [...evaluatedModelKeys, "pooled"]) {
    const modelRows = modelKey === "pooled" ? rows : rows.filter((row) => row.modelKey === modelKey);
    for (const lang of [...nonEnglishLanguageCodes, "all"]) {
      output.push(summarizeEffect(modelRows, effectType, lang, String(modelKey), "all"));
    }
  }
  return output;
}

function foundationBreakdown(rows: Row[]): EffectRow[] {
  const foundations = [...new Set(rows.map((row) => row.mft_foundation))].filter(Boolean).sort();
  return foundations.flatMap((foundation) =>
    (["language", "framing", "reasoning"] as EffectType[]).flatMap((effectType) =>
      [...nonEnglishLanguageCodes, "all"].map((lang) => summarizeEffect(rows.filter((row) => row.mft_foundation === foundation), effectType, lang, "pooled", foundation))
    )
  );
}

function modelComparisonTable(rows: Row[]): EffectRow[] {
  return evaluatedModelKeys.flatMap((modelKey) =>
    (["language", "framing", "reasoning"] as EffectType[]).flatMap((effectType) =>
      [...nonEnglishLanguageCodes, "all"].map((lang) => summarizeEffect(rows.filter((row) => row.modelKey === modelKey), effectType, lang, modelKey, "all"))
    )
  );
}

function summarizeEffect(rows: Row[], effectType: EffectType, lang: string, modelKey: string, foundation: string): EffectRow {
  const pairs = effectPairs(rows, effectType, lang);
  const summary = pairedSummary(pairs.map(([a, b]) => a - b));
  return {
    effect_type: effectType,
    language: lang,
    model_key: modelKey,
    mft_foundation: foundation,
    mean_diff: summary.mean,
    ci_lower: summary.ciLower,
    ci_upper: summary.ciUpper,
    p_value: summary.pValue,
    cohens_d: summary.cohensD,
    n: summary.n
  };
}

function effectPairs(rows: Row[], effectType: EffectType, lang: string) {
  const selectedLangs = lang === "all" ? nonEnglishLanguageCodes : [lang];
  const pairs: Array<[number, number]> = [];
  for (const selected of selectedLangs) {
    const targetRows = rows.filter((row) => {
      if (effectType === "language") return row.inputLang === selected && row.scenarioVersion === "translation" && row.reasoningLang === "en";
      if (effectType === "framing") return row.inputLang === selected && row.scenarioVersion === "adapted" && row.reasoningLang === "en";
      return row.inputLang === selected && row.scenarioVersion === "translation" && row.reasoningLang === selected;
    });
    const baselineRows = rows.filter((row) => {
      if (effectType === "language") return row.inputLang === "en" && row.scenarioVersion === "en" && row.reasoningLang === "en";
      if (effectType === "framing") return row.inputLang === selected && row.scenarioVersion === "translation" && row.reasoningLang === "en";
      return row.inputLang === selected && row.scenarioVersion === "translation" && row.reasoningLang === "en";
    });
    const baseline = new Map(baselineRows.map((row) => [pairKey(row, effectType), Number(row.parsedRating)]));
    for (const row of targetRows) {
      const a = Number(row.parsedRating);
      const b = baseline.get(pairKey(row, effectType));
      if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b as number]);
    }
  }
  return pairs;
}

function pairKey(row: Row, effectType: EffectType) {
  if (effectType === "language") return `${row.modelKey}|${row.scenarioId}`;
  if (effectType === "framing") return `${row.modelKey}|${row.scenarioId}`;
  return `${row.modelKey}|${row.scenarioId}`;
}

function referenceDivergence(rows: Row[]) {
  const ratings = rows.filter((row) => row.taskType === "rating");
  const reference = new Map(ratings.filter((row) => row.modelKey === "gemini_pro").map((row) => [`${row.scenarioId}|${row.conditionId}`, Number(row.parsedRating)]));
  const details = ratings
    .filter((row) => evaluatedModelKeys.includes(row.modelKey as never))
    .map((row) => {
      const ref = reference.get(`${row.scenarioId}|${row.conditionId}`);
      return {
        model_key: row.modelKey,
        scenario_id: row.scenarioId,
        condition_id: row.conditionId,
        language: row.inputLang,
        condition_type: conditionType(row),
        model_rating: Number(row.parsedRating),
        reference_rating: ref,
        absolute_difference: ref === undefined ? null : Math.abs(Number(row.parsedRating) - ref)
      };
    })
    .filter((row) => row.absolute_difference !== null);
  const summaryRows = [
    ...summarizeDivergence(details, ["model_key"]),
    ...summarizeDivergence(details, ["model_key", "language"]),
    ...summarizeDivergence(details, ["model_key", "condition_type"])
  ];
  const max = [...details].sort((a, b) => (b.absolute_difference ?? 0) - (a.absolute_difference ?? 0))[0];
  const overall = summarizeDivergence(details, ["model_key"]).sort((a, b) => Number(b.mean_absolute_difference) - Number(a.mean_absolute_difference))[0] as Record<string, unknown> | undefined;
  return summaryRows.map((row) => ({
    ...row,
    largest_divergence_model: String(overall?.model_key ?? ""),
    largest_specific_condition: max ? `${max.model_key}/${max.scenario_id}/${max.condition_id}/${max.absolute_difference}` : ""
  }));
}

function conditionType(row: Row) {
  if (row.conditionId === "en_en") return "en_en";
  return `${row.scenarioVersion}_reason_${row.reasoningLang === "en" ? "en" : "l2"}`;
}

function summarizeDivergence(rows: Array<Record<string, unknown>>, keys: string[]) {
  const groups = new Map<string, Array<Record<string, unknown>>>();
  for (const row of rows) {
    const key = keys.map((column) => String(row[column])).join("|");
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, group]) => {
    const values = group.map((row) => Number(row.absolute_difference));
    return {
      group_by: keys.join("+"),
      ...Object.fromEntries(keys.map((column, index) => [column, key.split("|")[index]])),
      n: values.length,
      mean_absolute_difference: values.reduce((sum, value) => sum + value, 0) / values.length
    };
  });
}

async function writeFigureData(rows: Row[], divergence: Array<Record<string, unknown>>) {
  const figure1 = modelComparisonTable(rows).filter((row) => row.effect_type === "language" && row.language !== "all");
  const figure3 = modelComparisonTable(rows).filter((row) => row.effect_type === "reasoning" && row.language !== "all");
  const figure2 = foundationBreakdown(rows).filter((row) => row.effect_type === "framing" && row.language !== "all");
  const figure4 = divergence.filter((row) => row.group_by === "model_key+condition_type");
  await Promise.all([
    writeFile(path.join(figureDataDir, "figure1_language_effect_by_model.csv"), toCsv(figure1), "utf8"),
    writeFile(path.join(figureDataDir, "figure2_framing_heatmap.csv"), toCsv(figure2), "utf8"),
    writeFile(path.join(figureDataDir, "figure3_reasoning_effect_by_model.csv"), toCsv(figure3), "utf8"),
    writeFile(path.join(figureDataDir, "figure4_reference_divergence.csv"), toCsv(figure4), "utf8")
  ]);
}

function pairedSummary(values: number[]) {
  const n = values.length;
  if (!n) return { n, mean: null, ciLower: null, ciUpper: null, pValue: null, cohensD: null };
  const mean = values.reduce((sum, value) => sum + value, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;
  const se = sd / Math.sqrt(n);
  const t = se ? mean / se : 0;
  const pValue = n > 1 ? 2 * (1 - studentTCdf(Math.abs(t), n - 1)) : null;
  return {
    n,
    mean,
    ciLower: n > 1 ? mean - 1.96 * se : null,
    ciUpper: n > 1 ? mean + 1.96 * se : null,
    pValue,
    cohensD: sd ? mean / sd : null
  };
}

function studentTCdf(t: number, df: number) {
  const x = df / (df + t * t);
  const ib = regularizedBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

function regularizedBeta(x: number, a: number, b: number) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return (bt * betaContinuedFraction(x, a, b)) / a;
  return 1 - (bt * betaContinuedFraction(1 - x, b, a)) / b;
}

function betaContinuedFraction(x: number, a: number, b: number) {
  const maxIterations = 200;
  const eps = 3e-7;
  const fpmin = 1e-30;
  let qab = a + b;
  let qap = a + 1;
  let qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= maxIterations; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < eps) break;
  }
  return h;
}

function logGamma(z: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.9999999999998099;
  for (let i = 0; i < coefficients.length; i += 1) x += coefficients[i] / (z + i + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function groupCount(rows: Row[], column: string) {
  return Object.fromEntries([...new Set(rows.map((row) => row[column]))].sort().map((value) => [value, rows.filter((row) => row[column] === value).length]));
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
