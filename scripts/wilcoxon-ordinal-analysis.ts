import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { nonEnglishLanguageCodes } from "../lib/languages";
import { evaluatedModelKeys } from "../lib/schemas";

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
  p_value_ttest: number | null;
  p_value_wilcoxon: number | null;
  wilcoxon_method: string;
  wilcoxon_nonzero_n: number;
  cohens_d: number | null;
  n: number;
  q_value_bh_wilcoxon?: string;
  fdr_significant_05_wilcoxon?: string;
  fdr_significant_10_wilcoxon?: string;
};

const root = process.cwd();
const processedDir = path.join(root, "results", "processed");
const analysisDir = path.join(processedDir, "analysis");
const ordinalDir = path.join(processedDir, "wilcoxon");
const fdrDir = path.join(processedDir, "fdr_wilcoxon");
const paperDir = path.join(root, "paper_materials");
const mergedFile = path.join(processedDir, "full_merged.csv");

const primaryFamilies = [
  { name: "language_effect", file: "language_effect_wilcoxon.csv" },
  { name: "framing_effect", file: "framing_effect_wilcoxon.csv" },
  { name: "reasoning_effect", file: "reasoning_effect_wilcoxon.csv" },
  { name: "foundation_breakdown", file: "foundation_breakdown_wilcoxon.csv" }
] as const;

async function main() {
  await Promise.all([mkdir(ordinalDir, { recursive: true }), mkdir(fdrDir, { recursive: true }), mkdir(paperDir, { recursive: true })]);
  const rows = await readCsv(mergedFile);
  const ratings = rows.filter((row) => row.taskType === "rating");
  const primaryRows = ratings.filter((row) => evaluatedModelKeys.includes(row.modelKey as never));

  const language = effectTable(primaryRows, "language");
  const framing = effectTable(primaryRows, "framing");
  const reasoning = effectTable(primaryRows, "reasoning");
  const foundation = foundationBreakdown(primaryRows);

  const families: Record<string, EffectRow[]> = {
    language_effect: addWilcoxonFdr(language),
    framing_effect: addWilcoxonFdr(framing),
    reasoning_effect: addWilcoxonFdr(reasoning),
    foundation_breakdown: addWilcoxonFdr(foundation)
  };

  await Promise.all([
    writeFile(path.join(ordinalDir, "language_effect_wilcoxon.csv"), toCsv(language), "utf8"),
    writeFile(path.join(ordinalDir, "framing_effect_wilcoxon.csv"), toCsv(framing), "utf8"),
    writeFile(path.join(ordinalDir, "reasoning_effect_wilcoxon.csv"), toCsv(reasoning), "utf8"),
    writeFile(path.join(ordinalDir, "foundation_breakdown_wilcoxon.csv"), toCsv(foundation), "utf8"),
    writeFile(path.join(fdrDir, "language_effect_wilcoxon_fdr.csv"), toCsv(families.language_effect), "utf8"),
    writeFile(path.join(fdrDir, "framing_effect_wilcoxon_fdr.csv"), toCsv(families.framing_effect), "utf8"),
    writeFile(path.join(fdrDir, "reasoning_effect_wilcoxon_fdr.csv"), toCsv(families.reasoning_effect), "utf8"),
    writeFile(path.join(fdrDir, "foundation_breakdown_wilcoxon_fdr.csv"), toCsv(families.foundation_breakdown), "utf8"),
    writeFile(path.join(processedDir, "rating_output_diagnostics.csv"), toCsv(ratingDiagnosticsRows(ratings)), "utf8")
  ]);

  await writeFile(path.join(processedDir, "statistical_test_and_rating_diagnostics.md"), diagnosticsReport(rows, ratings), "utf8");
  await writeFile(path.join(fdrDir, "fdr_summary_wilcoxon.md"), wilcoxonFdrSummary(families), "utf8");
  await writeFile(path.join(paperDir, "02_headline_findings_wilcoxon_fdr.md"), headlineFindingsWilcoxon(families), "utf8");

  console.log(`Wrote Wilcoxon ordinal-analysis tables to ${ordinalDir}`);
  console.log(`Wrote Wilcoxon FDR tables to ${fdrDir}`);
  console.log(`Wrote diagnostics report to ${path.join(processedDir, "statistical_test_and_rating_diagnostics.md")}`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
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

function summarizeEffect(rows: Row[], effectType: EffectType, lang: string, modelKey: string, foundation: string): EffectRow {
  const pairs = effectPairs(rows, effectType, lang);
  const diffs = pairs.map(([a, b]) => a - b);
  const tSummary = pairedTLikeSummary(diffs);
  const wilcoxon = wilcoxonSignedRank(diffs);
  return {
    effect_type: effectType,
    language: lang,
    model_key: modelKey,
    mft_foundation: foundation,
    mean_diff: tSummary.mean,
    ci_lower: tSummary.ciLower,
    ci_upper: tSummary.ciUpper,
    p_value_ttest: tSummary.pValue,
    p_value_wilcoxon: wilcoxon.pValue,
    wilcoxon_method: wilcoxon.method,
    wilcoxon_nonzero_n: wilcoxon.nonzeroN,
    cohens_d: tSummary.cohensD,
    n: tSummary.n
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
    const baseline = new Map(baselineRows.map((row) => [pairKey(row), Number(row.parsedRating)]));
    for (const row of targetRows) {
      const a = Number(row.parsedRating);
      const b = baseline.get(pairKey(row));
      if (Number.isFinite(a) && Number.isFinite(b)) pairs.push([a, b as number]);
    }
  }
  return pairs;
}

function pairKey(row: Row) {
  return `${row.modelKey}|${row.scenarioId}`;
}

function pairedTLikeSummary(values: number[]) {
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

function wilcoxonSignedRank(values: number[]) {
  const nonzero = values.filter((value) => value !== 0);
  const n = nonzero.length;
  if (!n) return { pValue: 1, nonzeroN: 0, method: "all paired differences are zero" };
  const ranked = rankAbs(nonzero);
  const wPlus = ranked.filter((entry) => entry.value > 0).reduce((sum, entry) => sum + entry.rank, 0);
  const totalRank = (n * (n + 1)) / 2;
  const wMinus = totalRank - wPlus;
  const w = Math.min(wPlus, wMinus);

  const hasTies = hasAbsTies(ranked.map((entry) => entry.abs));
  if (n <= 25 && !hasTies) {
    const p = exactWilcoxonPValue(n, w);
    return { pValue: p, nonzeroN: n, method: "exact two-sided signed-rank test; zero differences excluded" };
  }

  const tieCorrection = tieVarianceCorrection(ranked.map((entry) => entry.abs));
  const mean = totalRank / 2;
  const variance = (n * (n + 1) * (2 * n + 1) - tieCorrection) / 24;
  if (variance <= 0) return { pValue: 1, nonzeroN: n, method: "normal approximation unavailable; variance is zero" };
  const continuity = wPlus > mean ? -0.5 : wPlus < mean ? 0.5 : 0;
  const z = (wPlus - mean + continuity) / Math.sqrt(variance);
  const pValue = Math.min(1, 2 * (1 - normalCdf(Math.abs(z))));
  return { pValue, nonzeroN: n, method: "normal approximation two-sided signed-rank test with continuity and tie correction; zero differences excluded" };
}

function rankAbs(values: number[]) {
  const sorted = values.map((value) => ({ value, abs: Math.abs(value), rank: 0 })).sort((a, b) => a.abs - b.abs);
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].abs === sorted[i].abs) j += 1;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) sorted[k].rank = avgRank;
    i = j;
  }
  return sorted;
}

function tieVarianceCorrection(absValues: number[]) {
  const counts = new Map<number, number>();
  for (const value of absValues) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count * (count + 1) * (2 * count + 1), 0);
}

function hasAbsTies(absValues: number[]) {
  return new Set(absValues).size !== absValues.length;
}

function exactWilcoxonPValue(n: number, observedW: number) {
  const totalRank = (n * (n + 1)) / 2;
  const target = Math.floor(observedW + 1e-9);
  const counts = new Array(totalRank + 1).fill(0);
  counts[0] = 1;
  for (let rank = 1; rank <= n; rank += 1) {
    for (let sum = totalRank; sum >= rank; sum -= 1) counts[sum] += counts[sum - rank];
  }
  const extreme = counts.reduce((sum, count, rankSum) => {
    const w = Math.min(rankSum, totalRank - rankSum);
    return w <= target ? sum + count : sum;
  }, 0);
  return Math.min(1, extreme / 2 ** n);
}

function addWilcoxonFdr(rows: EffectRow[]) {
  const output = rows.map((row) => ({ ...row }));
  const tests = output
    .map((row, index) => ({ row, index, p: Number(row.p_value_wilcoxon) }))
    .filter((entry) => Number.isFinite(entry.p) && entry.p >= 0 && entry.p <= 1)
    .sort((a, b) => a.p - b.p);
  const m = tests.length;
  let runningMin = 1;
  for (let i = m - 1; i >= 0; i -= 1) {
    const rank = i + 1;
    const q = Math.min(runningMin, (tests[i].p * m) / rank, 1);
    runningMin = q;
    const row = output[tests[i].index];
    row.q_value_bh_wilcoxon = formatNumber(q);
    row.fdr_significant_05_wilcoxon = String(q < 0.05);
    row.fdr_significant_10_wilcoxon = String(q < 0.10);
  }
  return output;
}

function diagnosticsReport(allRows: Row[], ratingRows: Row[]) {
  const totalRating = ratingRows.length;
  const requiringRetry = ratingRows.filter((row) => Number(row.attemptCount) > 1);
  const malformedAfterRetries = ratingRows.filter((row) => row.errorNote || !isValidRating(row.parsedRating));
  const nullRatings = ratingRows.filter((row) => !row.parsedRating);
  const diagnosticRows = ratingDiagnosticsRows(ratingRows);
  const byModel = diagnosticRows.filter((row) => row.group_type === "model");
  const byLanguage = diagnosticRows.filter((row) => row.group_type === "language");
  const byCondition = diagnosticRows.filter((row) => row.group_type === "condition_type");

  return `# Statistical Test And Rating Output Diagnostics

## Existing Statistical Tests In Finalized Result Tables

The p-values currently present in \`results/processed/analysis/language_effects.csv\`, \`framing_effects.csv\`, \`reasoning_effects.csv\`, and \`foundation_breakdown.csv\` were produced by a two-sided paired t-test on paired rating differences.

- \`language_effect\`: paired t-test comparing L-translation-reason-EN against the same model/scenario English baseline.
- \`framing_effect\`: paired t-test comparing L-adapted-reason-EN against L-translation-reason-EN for the same model/scenario.
- \`reasoning_effect\`: paired t-test comparing L-translation-reason-L2 against L-translation-reason-EN for the same model/scenario.
- \`foundation_breakdown\`: the same paired t-test logic as above, after subsetting rows by designed MFT foundation.

The implementation computes paired differences first, then uses t = mean(diff) / SE(diff) and a Student t distribution with n - 1 degrees of freedom. The relevant code path is \`scripts/post-expansion-analysis.ts -> summarizeEffect() -> pairedSummary()\`.

## Confidence Intervals And Unit Of Variance

The 95% confidence intervals in the finalized tables were computed as mean paired difference +/- 1.96 x standard error of paired differences. The standard error is SD(diff) / sqrt(n), where diff is the within-pair rating difference.

Yes: uncertainty is estimated over paired scenario-level differences, with the model included in the pairing key for model-specific and pooled effects. For pooled effects, the variance unit is the paired model-scenario difference. For foundation breakdowns, the same paired-difference unit is used after filtering to that foundation.

## Rating Diagnostics

- Total rating work units: ${totalRating}
- Rating rows with \`attemptCount > 1\` requiring a work-unit retry: ${requiringRetry.length}
- Malformed outputs after retries, defined as non-null \`errorNote\` or final \`parsedRating\` not in 1-7: ${malformedAfterRetries.length}
- Missing/null ratings in final analysis: ${nullRatings.length}

Important caveat: internal retry attempts inside \`runRatingTask()\` are not separately persisted in the final CSV. Therefore, \`attemptCount > 1\` captures work-unit-level retries visible in saved data, not every internal malformed-output retry that may have happened before a successful final parse.

### Breakdown By Model

${markdownTable(byModel)}

### Breakdown By Language

${markdownTable(byLanguage)}

### Breakdown By Condition Type

${markdownTable(byCondition)}
`;
}

function ratingDiagnosticsRows(rows: Row[]) {
  const groups = [
    { group_type: "overall", entries: [{ group_value: "all", rows }] },
    { group_type: "model", entries: groupRows(rows, (row) => row.modelKey) },
    { group_type: "language", entries: groupRows(rows, (row) => row.inputLang) },
    { group_type: "condition_type", entries: groupRows(rows, conditionType) }
  ];
  return groups.flatMap((group) =>
    group.entries.map((entry) => ({
      group_type: group.group_type,
      group_value: entry.group_value,
      total_rating_work_units: entry.rows.length,
      outputs_requiring_workunit_retry_attemptCount_gt_1: entry.rows.filter((row) => Number(row.attemptCount) > 1).length,
      malformed_after_retries_or_error: entry.rows.filter((row) => row.errorNote || !isValidRating(row.parsedRating)).length,
      missing_null_ratings_final: entry.rows.filter((row) => !row.parsedRating).length
    }))
  );
}

function wilcoxonFdrSummary(families: Record<string, EffectRow[]>) {
  const familySummary = Object.entries(families).map(([family, rows]) => {
    const tested = rows.filter((row) => Number.isFinite(Number(row.p_value_wilcoxon)));
    return {
      family,
      tests: tested.length,
      surviving_q_lt_05: tested.filter((row) => Number(row.q_value_bh_wilcoxon) < 0.05).length,
      surviving_q_lt_10: tested.filter((row) => Number(row.q_value_bh_wilcoxon) < 0.10).length
    };
  });
  const strongest = Object.entries(families)
    .flatMap(([family, rows]) => rows.map((row) => ({ family, ...row })))
    .filter((row) => Number(row.q_value_bh_wilcoxon) < 0.10 && Number.isFinite(Number(row.cohens_d)))
    .sort((a, b) => Math.abs(Number(b.cohens_d)) - Math.abs(Number(a.cohens_d)))
    .slice(0, 25);

  return `# Wilcoxon Signed-Rank FDR Summary

Wilcoxon p-values are two-sided signed-rank tests on the same paired differences used by the original paired t-test tables. Zero differences are excluded from the signed-rank statistic. Exact p-values are used only when nonzero n <= 25 and the nonzero absolute differences have no ties; otherwise a normal approximation with continuity and tie correction is used.

\`model_comparison\` remains excluded from the primary FDR families to avoid double-counting.

## Tests Per Family

${markdownTable(familySummary)}

## Strongest Surviving Findings

Sorted by absolute Cohen's d among rows with Wilcoxon q < .10.

${markdownTable(strongest.map(displayWilcoxonRow))}
`;
}

function headlineFindingsWilcoxon(families: Record<string, EffectRow[]>) {
  const rows = Object.entries(families)
    .flatMap(([family, familyRows]) => familyRows.map((row) => ({ family, ...row })))
    .filter((row) => Number.isFinite(Number(row.p_value_wilcoxon)) && Number.isFinite(Number(row.cohens_d)))
    .sort((a, b) => {
      const fdrA = Number(a.q_value_bh_wilcoxon) < 0.10 ? 0 : 1;
      const fdrB = Number(b.q_value_bh_wilcoxon) < 0.10 ? 0 : 1;
      if (fdrA !== fdrB) return fdrA - fdrB;
      const d = Math.abs(Number(b.cohens_d)) - Math.abs(Number(a.cohens_d));
      if (d !== 0) return d;
      return Number(a.q_value_bh_wilcoxon) - Number(b.q_value_bh_wilcoxon);
    })
    .slice(0, 10);

  return `# Headline Findings With Wilcoxon Signed-Rank FDR Correction

These findings use two-sided Wilcoxon signed-rank p-values as the primary ordinal-data analysis, with Benjamini-Hochberg correction applied separately within language_effect, framing_effect, reasoning_effect, and foundation_breakdown. \`model_comparison\` is excluded to avoid double-counting.

${rows
  .map((row, index) => {
    const survives = Number(row.q_value_bh_wilcoxon) < 0.05 ? "survives Wilcoxon q < .05" : Number(row.q_value_bh_wilcoxon) < 0.10 ? "survives Wilcoxon q < .10 only" : "does not survive Wilcoxon q < .10";
    return `${index + 1}. ${describe(row)} showed mean_diff=${row.mean_diff}, 95% CI=[${row.ci_lower}, ${row.ci_upper}], Wilcoxon p=${row.p_value_wilcoxon}, Wilcoxon q_BH=${row.q_value_bh_wilcoxon}, original paired-t p=${row.p_value_ttest}, Cohen's d=${row.cohens_d}, n=${row.n}, nonzero Wilcoxon n=${row.wilcoxon_nonzero_n}; ${survives}.`;
  })
  .join("\n")}
`;
}

function displayWilcoxonRow(row: EffectRow & { family: string }) {
  return {
    family: row.family,
    effect_type: row.effect_type,
    model_key: row.model_key,
    language: row.language,
    mft_foundation: row.mft_foundation,
    mean_diff: row.mean_diff,
    ci_lower: row.ci_lower,
    ci_upper: row.ci_upper,
    p_value_wilcoxon: row.p_value_wilcoxon,
    q_value_bh_wilcoxon: row.q_value_bh_wilcoxon,
    fdr_significant_05_wilcoxon: row.fdr_significant_05_wilcoxon,
    fdr_significant_10_wilcoxon: row.fdr_significant_10_wilcoxon,
    p_value_ttest: row.p_value_ttest,
    cohens_d: row.cohens_d,
    n: row.n,
    wilcoxon_nonzero_n: row.wilcoxon_nonzero_n
  };
}

function describe(row: EffectRow & { family: string }) {
  return [
    row.family,
    `effect=${row.effect_type}`,
    `model=${row.model_key}`,
    `language=${row.language}`,
    row.mft_foundation !== "all" ? `foundation=${row.mft_foundation}` : ""
  ].filter(Boolean).join(", ");
}

function conditionType(row: Row) {
  if (row.conditionId === "en_en") return "en_en";
  return `${row.scenarioVersion}_reason_${row.reasoningLang === "en" ? "en" : "l2"}`;
}

function isValidRating(value: string) {
  const rating = Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 7;
}

function groupRows(rows: Row[], keyFn: (row: Row) => string) {
  const map = new Map<string, Row[]>();
  for (const row of rows) {
    const key = keyFn(row);
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([group_value, groupRows]) => ({ group_value, rows: groupRows }));
}

function studentTCdf(t: number, df: number) {
  const x = df / (df + t * t);
  const ib = regularizedBeta(x, df / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

function normalCdf(x: number) {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax));
  return sign * y;
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

function toCsv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`;
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function markdownTable(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.map(escapeMarkdown).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => escapeMarkdown(row[header])).join(" | ")} |`)
  ].join("\n");
}

function escapeMarkdown(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  return value.toPrecision(16).replace(/\.?0+$/, "");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
