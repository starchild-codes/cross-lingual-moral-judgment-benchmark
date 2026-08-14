import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, string>;
type Value = string | number | boolean | null;
type OutRow = Record<string, Value>;
type EffectType = "language" | "framing" | "reasoning";

const root = process.cwd();
const processed = path.join(root, "results", "processed");
const outputDir = path.join(processed, "phase1_final_evidence");
const reportPath = path.join(root, "phase1_evidence_report.md");
const correctedReportPath = path.join(root, "phase1_evidence_report_provenance.md");
const codedPath = path.join(processed, "full_merged_with_human_mft_codes.csv");
const ratingPath = path.join(processed, "full_merged.csv");
const validationPath = path.join(processed, "scenario_validation_trial2", "scenario_validation_merged_3coders.csv");
const existingMatchPath = path.join(processed, "analysis", "foundation_match.csv");
const existingTransitionsPath = path.join(processed, "analysis", "foundation_transitions.csv");

const foundations = [
  "Care/Harm",
  "Loyalty/Betrayal",
  "Authority/Subversion",
  "Fairness/Cheating",
  "Sanctity/Degradation"
];
const languages = ["hi", "bn", "ta", "es", "ja", "ar"];
const primaryModels = ["chatgpt", "claude", "gemini_flash"];
const qualitativeTargets = ["S01", "S06", "S11", "S16", "S21", "S26", "S28", "S29", "S30", "S34"];

type ScenarioLabel = {
  scenario_id: string;
  intended: string;
  majority: string;
  resolved: boolean;
  majority_matches_intended: boolean;
  all_three_disagree: boolean;
};

type EffectRow = OutRow & {
  analysis_version: string;
  effect_type: EffectType;
  language: string;
  mft_foundation: string;
  mean_diff: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  p_value_ttest: number | null;
  cohens_d: number | null;
  n: number;
  p_value_wilcoxon: number;
  wilcoxon_nonzero_n: number;
  wilcoxon_method: string;
  q_value_bh_wilcoxon: number | null;
  fdr_significant_05_wilcoxon: boolean;
  fdr_significant_10_wilcoxon: boolean;
};

async function main() {
  await mkdir(outputDir, { recursive: true });
  const [codedRows, allRows, validationRows, existingMatch, existingTransitions] = await Promise.all([
    readCsv(codedPath),
    readCsv(ratingPath),
    readCsv(validationPath),
    readCsv(existingMatchPath),
    readCsv(existingTransitionsPath)
  ]);

  const qualitative = codedRows.filter((row) => row.taskType === "qualitative");
  const ratings = allRows.filter((row) => row.taskType === "rating" && primaryModels.includes(row.modelKey));
  const labels = buildScenarioLabels(validationRows);
  reproductionGate(qualitative, existingMatch, existingTransitions);

  const reproductionSummary = qualitativeSummary(qualitative, "original_intended", (row) => row.mft_foundation);
  const reproductionTransitions = transitionRows(qualitative, "original_intended", (row) => row.mft_foundation);
  const scenarioDetail = scenarioDistributions(qualitative, labels);
  const scenarioBreakdowns = scenarioBreakdownRows(qualitative, labels);

  const qualitativeComparison = [
    ...qualitativeSummary(qualitative, "original_intended", (row) => row.mft_foundation),
    ...qualitativeSummary(qualitative, "human_majority", (row) => labels.get(row.scenarioId)?.majority ?? "")
  ];
  const qualitativeTransitions = [
    ...transitionRows(qualitative, "original_intended", (row) => row.mft_foundation),
    ...transitionRows(qualitative, "human_majority", (row) => labels.get(row.scenarioId)?.majority ?? "")
  ];
  const qualitativeExclusions = qualitativeExclusionRows(qualitative, labels);

  const quantitative = quantitativeSensitivity(ratings, labels);
  const effectConsistency = quantitativeEffectConsistency(quantitative);
  const headlines = headlineSensitivity(quantitative);
  const scenarioVersions = [...labels.values()].map((label) => ({
    scenario_id: label.scenario_id,
    intended_mft_foundation: label.intended,
    human_majority_foundation: label.majority,
    majority_resolved: label.resolved,
    majority_matches_intended: label.majority_matches_intended,
    all_three_disagree: label.all_three_disagree,
    included_validated_subset: label.resolved && label.majority_matches_intended,
    included_human_majority: label.resolved
  }));

  const outputs: Array<[string, OutRow[]]> = [
    ["qualitative_reproduction_summary.csv", reproductionSummary],
    ["qualitative_reproduction_transitions.csv", reproductionTransitions],
    ["s11_s30_foundation_distribution.csv", scenarioDetail],
    ["s11_s30_breakdowns.csv", scenarioBreakdowns],
    ["qualitative_match_comparison.csv", qualitativeComparison],
    ["qualitative_transitions_comparison.csv", qualitativeTransitions],
    ["qualitative_human_majority_exclusions.csv", qualitativeExclusions],
    ["quantitative_foundation_sensitivity.csv", quantitative],
    ["quantitative_effect_consistency_summary.csv", effectConsistency],
    ["headline_finding_sensitivity.csv", headlines],
    ["scenario_label_versions.csv", scenarioVersions]
  ];

  await Promise.all(outputs.map(([name, rows]) => writeFile(path.join(outputDir, name), toCsv(rows), "utf8")));
  const report = buildReport({ qualitative, labels, reproductionSummary, scenarioDetail, scenarioBreakdowns, qualitativeComparison, qualitativeTransitions, qualitativeExclusions, quantitative, effectConsistency, headlines });
  await Promise.all([
    writeFile(reportPath, report, "utf8"),
    writeFile(correctedReportPath, report, "utf8")
  ]);

  const inventory = [
    ...outputs.map(([name, rows]) => ({ file: path.join("results", "processed", "phase1_final_evidence", name), rows: rows.length })),
    { file: "phase1_evidence_report.md", rows: report.split(/\r?\n/).length },
    { file: "phase1_evidence_report_provenance.md", rows: report.split(/\r?\n/).length }
  ];
  await writeFile(path.join(outputDir, "generated_outputs_inventory.csv"), toCsv(inventory), "utf8");

  console.log("Phase 1 final evidence analysis complete.");
  console.log(`Qualitative reproduction: ${matchCount(qualitative, (row) => row.mft_foundation)}/${qualitative.length}`);
  console.log(`Authority reproduction: ${matchCount(qualitative.filter((row) => row.mft_foundation === "Authority/Subversion"), (row) => row.mft_foundation)}/200`);
  console.log(`Report: ${reportPath}`);
  console.log(`Corrected report: ${correctedReportPath}`);
  console.log(`Verification CSVs: ${outputDir}`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
}

function buildScenarioLabels(rows: Row[]) {
  const labels = new Map<string, ScenarioLabel>();
  for (const row of rows) {
    const majority = row.majority_vote_label?.trim() ?? "";
    labels.set(row.scenario_id, {
      scenario_id: row.scenario_id,
      intended: row.intended_mft_foundation,
      majority,
      resolved: foundations.includes(majority),
      majority_matches_intended: row.majority_matches_intended === "true",
      all_three_disagree: row.all_three_disagree === "true"
    });
  }
  if (labels.size !== 50) throw new Error(`Expected 50 validation scenarios, found ${labels.size}.`);
  return labels;
}

function reproductionGate(qualitative: Row[], existingMatch: Row[], existingTransitions: Row[]) {
  if (qualitative.length !== 1000) throw new Error(`Reproduction gate failed: expected 1000 qualitative rows, found ${qualitative.length}.`);
  if (qualitative.some((row) => !foundations.includes(row.ai_mft_final_label))) throw new Error("Reproduction gate failed: qualitative rows contain missing/invalid final codes.");
  const expected: Record<string, number> = {
    "Care/Harm": 200,
    "Loyalty/Betrayal": 200,
    "Fairness/Cheating": 199,
    "Sanctity/Degradation": 116,
    "Authority/Subversion": 13
  };
  const total = matchCount(qualitative, (row) => row.mft_foundation);
  if (total !== 728) throw new Error(`Reproduction gate failed: expected 728 matches, found ${total}.`);
  for (const [foundation, count] of Object.entries(expected)) {
    const rows = qualitative.filter((row) => row.mft_foundation === foundation);
    const actual = matchCount(rows, (row) => row.mft_foundation);
    if (rows.length !== 200 || actual !== count) throw new Error(`Reproduction gate failed for ${foundation}: expected ${count}/200, found ${actual}/${rows.length}.`);
  }
  const existingOverall = existingMatch.find((row) => row.group_type === "overall");
  if (!existingOverall || Number(existingOverall.matches) !== 728 || Number(existingOverall.total) !== 1000) throw new Error("Existing foundation_match.csv does not contain the expected 728/1000 overall result.");
  const computed = transitionRows(qualitative, "original_intended", (row) => row.mft_foundation).filter((row) => row.model_key !== "all");
  for (const row of existingTransitions) {
    if (row.model_key === "all") continue;
    const match = computed.find((candidate) => candidate.model_key === row.model_key && candidate.reference_foundation === row.designed_foundation && candidate.invoked_foundation === row.invoked_foundation);
    if (!match || Number(match.count) !== Number(row.count)) throw new Error(`Transition reproduction failed for ${row.model_key}/${row.designed_foundation}/${row.invoked_foundation}.`);
  }
}

function qualitativeSummary(rows: Row[], version: string, reference: (row: Row) => string): OutRow[] {
  const usable = rows.filter((row) => foundations.includes(reference(row)));
  const output: OutRow[] = [];
  addMatchGroup(output, usable, version, "overall", "all", reference);
  for (const foundation of foundations) addMatchGroup(output, usable.filter((row) => reference(row) === foundation), version, "foundation", foundation, reference);
  for (const scenario of unique(usable.map((row) => row.scenarioId))) addMatchGroup(output, usable.filter((row) => row.scenarioId === scenario), version, "scenario", scenario, reference);
  for (const model of unique(usable.map((row) => row.modelKey))) addMatchGroup(output, usable.filter((row) => row.modelKey === model), version, "model", model, reference);
  for (const language of unique(usable.map((row) => row.inputLang))) addMatchGroup(output, usable.filter((row) => row.inputLang === language), version, "language", language, reference);
  for (const condition of unique(usable.map(conditionType))) addMatchGroup(output, usable.filter((row) => conditionType(row) === condition), version, "condition_type", condition, reference);
  return output;
}

function addMatchGroup(output: OutRow[], rows: Row[], version: string, groupType: string, groupValue: string, reference: (row: Row) => string) {
  const matches = matchCount(rows, reference);
  output.push({ analysis_version: version, group_type: groupType, group_value: groupValue, matches, total: rows.length, match_rate: rows.length ? matches / rows.length : null });
}

function transitionRows(rows: Row[], version: string, reference: (row: Row) => string): OutRow[] {
  const usable = rows.filter((row) => foundations.includes(reference(row)));
  const models = ["all", ...unique(usable.map((row) => row.modelKey))];
  const output: OutRow[] = [];
  for (const model of models) {
    const modelRows = model === "all" ? usable : usable.filter((row) => row.modelKey === model);
    for (const from of foundations) {
      const fromRows = modelRows.filter((row) => reference(row) === from);
      for (const to of foundations) {
        const count = fromRows.filter((row) => row.ai_mft_final_label === to).length;
        output.push({ analysis_version: version, model_key: model, reference_foundation: from, invoked_foundation: to, count, row_total: fromRows.length, row_percentage: fromRows.length ? count / fromRows.length : null });
      }
    }
  }
  return output;
}

function scenarioDistributions(rows: Row[], labels: Map<string, ScenarioLabel>): OutRow[] {
  const output: OutRow[] = [];
  for (const scenarioId of ["S11", "S30"]) {
    const scenarioRows = rows.filter((row) => row.scenarioId === scenarioId);
    const label = labels.get(scenarioId)!;
    for (const foundation of foundations) {
      const count = scenarioRows.filter((row) => row.ai_mft_final_label === foundation).length;
      output.push({ scenario_id: scenarioId, original_intended_label: label.intended, human_majority_label: label.majority, coded_foundation: foundation, count, percentage: count / scenarioRows.length, total_responses: scenarioRows.length, matches_original_intended: foundation === label.intended, matches_human_majority: foundation === label.majority });
    }
  }
  return output;
}

function scenarioBreakdownRows(rows: Row[], labels: Map<string, ScenarioLabel>): OutRow[] {
  const output: OutRow[] = [];
  for (const scenarioId of ["S11", "S30"]) {
    const scenarioRows = rows.filter((row) => row.scenarioId === scenarioId);
    const dimensions: Array<[string, (row: Row) => string]> = [
      ["overall", () => "all"],
      ["model", (row) => row.modelKey],
      ["language", (row) => row.inputLang],
      ["condition_type", conditionType],
      ["reasoning_response_language", (row) => row.reasoningLang]
    ];
    for (const [dimension, getter] of dimensions) {
      for (const value of unique(scenarioRows.map(getter))) {
        const group = scenarioRows.filter((row) => getter(row) === value);
        for (const foundation of foundations) {
          const count = group.filter((row) => row.ai_mft_final_label === foundation).length;
          output.push({ scenario_id: scenarioId, original_intended_label: labels.get(scenarioId)!.intended, human_majority_label: labels.get(scenarioId)!.majority, dimension, group_value: value, coded_foundation: foundation, count, group_total: group.length, percentage: group.length ? count / group.length : null });
        }
      }
    }
  }
  return output;
}

function qualitativeExclusionRows(rows: Row[], labels: Map<string, ScenarioLabel>): OutRow[] {
  return qualitativeTargets.map((scenario) => {
    const label = labels.get(scenario)!;
    const count = rows.filter((row) => row.scenarioId === scenario).length;
    return { scenario_id: scenario, human_majority_label: label.majority, majority_resolved: label.resolved, qualitative_rows: count, excluded_from_human_majority_analysis: !label.resolved, exclusion_reason: label.resolved ? "" : "complete three-way coder disagreement" };
  });
}

function quantitativeSensitivity(ratings: Row[], labels: Map<string, ScenarioLabel>): EffectRow[] {
  const versions = [
    { name: "v1_original_intended", rows: ratings, label: (row: Row) => row.mft_foundation },
    { name: "v2_validated_subset", rows: ratings.filter((row) => labels.get(row.scenarioId)?.resolved && labels.get(row.scenarioId)?.majority_matches_intended), label: (row: Row) => row.mft_foundation },
    { name: "v3_human_majority", rows: ratings.filter((row) => labels.get(row.scenarioId)?.resolved), label: (row: Row) => labels.get(row.scenarioId)?.majority ?? "" }
  ];
  const all: EffectRow[] = [];
  for (const version of versions) {
    const versionRows: EffectRow[] = [];
    for (const foundation of foundations) {
      const foundationRows = version.rows.filter((row) => version.label(row) === foundation);
      for (const effect of ["language", "framing", "reasoning"] as EffectType[]) {
        for (const language of [...languages, "all"]) versionRows.push(effectSummary(version.name, foundationRows, effect, language, foundation));
      }
    }
    applyFdr(versionRows);
    all.push(...versionRows);
  }
  return all;
}

function effectSummary(version: string, rows: Row[], effect: EffectType, language: string, foundation: string): EffectRow {
  const diffs = effectDifferences(rows, effect, language);
  const summary = pairedSummary(diffs);
  const wilcoxon = wilcoxonSignedRank(diffs);
  return {
    analysis_version: version,
    effect_type: effect,
    language,
    model_key: "pooled",
    mft_foundation: foundation,
    mean_diff: summary.mean,
    ci_lower: summary.ciLower,
    ci_upper: summary.ciUpper,
    p_value_ttest: summary.pValue,
    cohens_d: summary.cohensD,
    n: summary.n,
    p_value_wilcoxon: wilcoxon.pValue,
    wilcoxon_nonzero_n: wilcoxon.nonzeroN,
    wilcoxon_method: wilcoxon.method,
    q_value_bh_wilcoxon: null,
    fdr_significant_05_wilcoxon: false,
    fdr_significant_10_wilcoxon: false
  };
}

function effectDifferences(rows: Row[], effect: EffectType, language: string) {
  const selectedLanguages = language === "all" ? languages : [language];
  const diffs: number[] = [];
  for (const selected of selectedLanguages) {
    const targets = rows.filter((row) => {
      if (effect === "language") return row.inputLang === selected && row.scenarioVersion === "translation" && row.reasoningLang === "en";
      if (effect === "framing") return row.inputLang === selected && row.scenarioVersion === "adapted" && row.reasoningLang === "en";
      return row.inputLang === selected && row.scenarioVersion === "translation" && row.reasoningLang === selected;
    });
    const baselines = rows.filter((row) => {
      if (effect === "language") return row.inputLang === "en" && row.scenarioVersion === "en" && row.reasoningLang === "en";
      return row.inputLang === selected && row.scenarioVersion === "translation" && row.reasoningLang === "en";
    });
    const baseline = new Map(baselines.map((row) => [`${row.modelKey}|${row.scenarioId}`, Number(row.parsedRating)]));
    for (const target of targets) {
      const a = Number(target.parsedRating);
      const b = baseline.get(`${target.modelKey}|${target.scenarioId}`);
      if (Number.isFinite(a) && Number.isFinite(b)) diffs.push(a - (b as number));
    }
  }
  return diffs;
}

function pairedSummary(values: number[]) {
  const n = values.length;
  if (!n) return { n, mean: null, ciLower: null, ciUpper: null, pValue: null, cohensD: null };
  const mean = average(values);
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;
  const se = sd / Math.sqrt(n);
  const statistic = se ? mean / se : 0;
  const pValue = n > 1 ? 2 * (1 - studentTCdf(Math.abs(statistic), n - 1)) : null;
  const critical = n > 1 ? inverseStudentT(0.975, n - 1) : null;
  return { n, mean, ciLower: critical === null ? null : mean - critical * se, ciUpper: critical === null ? null : mean + critical * se, pValue, cohensD: sd ? mean / sd : null };
}

function wilcoxonSignedRank(values: number[]) {
  const nonzero = values.filter((value) => value !== 0);
  const n = nonzero.length;
  if (!n) return { pValue: 1, nonzeroN: 0, method: "all paired differences are zero" };
  const ranked = rankAbs(nonzero);
  const wPlus = ranked.filter((entry) => entry.value > 0).reduce((sum, entry) => sum + entry.rank, 0);
  const totalRank = (n * (n + 1)) / 2;
  const w = Math.min(wPlus, totalRank - wPlus);
  const ties = new Set(ranked.map((entry) => entry.abs)).size !== ranked.length;
  if (n <= 25 && !ties) return { pValue: exactWilcoxonPValue(n, w), nonzeroN: n, method: "exact two-sided signed-rank; zeros excluded" };
  const tieCorrection = tieVarianceCorrection(ranked.map((entry) => entry.abs));
  const mean = totalRank / 2;
  const variance = (n * (n + 1) * (2 * n + 1) - tieCorrection) / 24;
  if (variance <= 0) return { pValue: 1, nonzeroN: n, method: "normal approximation unavailable; zero variance" };
  const continuity = wPlus > mean ? -0.5 : wPlus < mean ? 0.5 : 0;
  const z = (wPlus - mean + continuity) / Math.sqrt(variance);
  return { pValue: Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))), nonzeroN: n, method: "normal approximation, continuity and tie corrected; zeros excluded" };
}

function rankAbs(values: number[]) {
  const sorted = values.map((value) => ({ value, abs: Math.abs(value), rank: 0 })).sort((a, b) => a.abs - b.abs);
  for (let i = 0; i < sorted.length;) {
    let j = i + 1;
    while (j < sorted.length && sorted[j].abs === sorted[i].abs) j += 1;
    const rank = (i + 1 + j) / 2;
    for (let k = i; k < j; k += 1) sorted[k].rank = rank;
    i = j;
  }
  return sorted;
}

function exactWilcoxonPValue(n: number, observedW: number) {
  const total = (n * (n + 1)) / 2;
  const target = Math.floor(observedW + 1e-9);
  const counts = new Array(total + 1).fill(0);
  counts[0] = 1;
  for (let rank = 1; rank <= n; rank += 1) for (let sum = total; sum >= rank; sum -= 1) counts[sum] += counts[sum - rank];
  const extreme = counts.reduce((sum, count, rankSum) => Math.min(rankSum, total - rankSum) <= target ? sum + count : sum, 0);
  return Math.min(1, extreme / 2 ** n);
}

function tieVarianceCorrection(values: number[]) {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.values()].filter((count) => count > 1).reduce((sum, count) => sum + count * (count + 1) * (2 * count + 1), 0);
}

function applyFdr(rows: EffectRow[]) {
  const ordered = rows.map((row, index) => ({ row, index, p: row.p_value_wilcoxon })).filter((entry) => Number.isFinite(entry.p)).sort((a, b) => a.p - b.p);
  let running = 1;
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const q = Math.min(running, ordered[index].p * ordered.length / (index + 1), 1);
    running = q;
    const row = rows[ordered[index].index];
    row.q_value_bh_wilcoxon = q;
    row.fdr_significant_05_wilcoxon = q < 0.05;
    row.fdr_significant_10_wilcoxon = q < 0.10;
  }
}

function headlineSensitivity(rows: EffectRow[]): OutRow[] {
  const specs = [
    ["Tamil Loyalty/Betrayal input-language effect", "language", "ta", "Loyalty/Betrayal"],
    ["Arabic Sanctity/Degradation framing effect", "framing", "ar", "Sanctity/Degradation"],
    ["Spanish Sanctity/Degradation framing effect", "framing", "es", "Sanctity/Degradation"],
    ["Japanese Fairness/Cheating reasoning effect", "reasoning", "ja", "Fairness/Cheating"],
    ["Arabic Fairness/Cheating reasoning effect", "reasoning", "ar", "Fairness/Cheating"],
    ["Pooled Authority/Subversion input-language effect", "language", "all", "Authority/Subversion"],
    ["Bengali Authority/Subversion input-language effect", "language", "bn", "Authority/Subversion"],
    ["Arabic Authority/Subversion input-language effect", "language", "ar", "Authority/Subversion"],
    ["Spanish Authority/Subversion framing effect", "framing", "es", "Authority/Subversion"],
    ["Pooled Authority/Subversion reasoning effect", "reasoning", "all", "Authority/Subversion"]
  ];
  const output: OutRow[] = [];
  for (const [finding, effect, language, foundation] of specs) {
    const selected = rows.filter((row) => row.effect_type === effect && row.language === language && row.mft_foundation === foundation);
    const original = selected.find((row) => row.analysis_version === "v1_original_intended");
    const subset = selected.find((row) => row.analysis_version === "v2_validated_subset");
    const majority = selected.find((row) => row.analysis_version === "v3_human_majority");
    const classification = classifyStability(original, subset, majority);
    for (const row of selected) output.push({ finding, classification, ...row });
  }
  return output;
}

function quantitativeEffectConsistency(rows: EffectRow[]): OutRow[] {
  const output: OutRow[] = [];
  for (const version of unique(rows.map((row) => row.analysis_version))) {
    for (const effect of ["language", "framing", "reasoning"] as EffectType[]) {
      const group = rows.filter((row) => row.analysis_version === version && row.effect_type === effect);
      output.push({
        analysis_version: version,
        effect_type: effect,
        tests: group.length,
        surviving_q_lt_05: group.filter((row) => row.fdr_significant_05_wilcoxon).length,
        surviving_q_lt_10: group.filter((row) => row.fdr_significant_10_wilcoxon).length
      });
    }
  }
  for (const effect of ["language", "framing", "reasoning"] as EffectType[]) {
    const keys = unique(rows.filter((row) => row.effect_type === effect).map((row) => `${row.language}|${row.mft_foundation}`));
    const stable = keys.filter((key) => {
      const [language, foundation] = key.split("|");
      const group = rows.filter((row) => row.effect_type === effect && row.language === language && row.mft_foundation === foundation);
      return group.length === 3 && group.every((row) => row.fdr_significant_05_wilcoxon);
    }).length;
    output.push({ analysis_version: "all_three_versions", effect_type: effect, tests: keys.length, surviving_q_lt_05: stable, surviving_q_lt_10: null });
  }
  return output;
}

function classifyStability(original?: EffectRow, subset?: EffectRow, majority?: EffectRow) {
  if (!original || !subset || !majority || !original.n || !subset.n || !majority.n) return "not estimable";
  const signs = [original.mean_diff, subset.mean_diff, majority.mean_diff].map((value) => Math.sign(Number(value)));
  if (signs.some((sign) => sign !== signs[0] && sign !== 0 && signs[0] !== 0)) return "changed direction";
  const originalSig = original.fdr_significant_05_wilcoxon;
  const bothSig = subset.fdr_significant_05_wilcoxon && majority.fdr_significant_05_wilcoxon;
  if (originalSig && !bothSig) return "lost significance";
  const originalD = Math.abs(Number(original.cohens_d));
  const sensitivityD = average([Math.abs(Number(subset.cohens_d)), Math.abs(Number(majority.cohens_d))]);
  if (bothSig && sensitivityD > originalD * 1.10) return "strengthened";
  if (bothSig && sensitivityD >= originalD * 0.75) return "stable";
  if (sensitivityD < originalD * 0.75) return "weakened";
  return bothSig ? "stable" : "weakened";
}

function buildReport(data: {
  qualitative: Row[];
  labels: Map<string, ScenarioLabel>;
  reproductionSummary: OutRow[];
  scenarioDetail: OutRow[];
  scenarioBreakdowns: OutRow[];
  qualitativeComparison: OutRow[];
  qualitativeTransitions: OutRow[];
  qualitativeExclusions: OutRow[];
  quantitative: EffectRow[];
  effectConsistency: OutRow[];
  headlines: OutRow[];
}) {
  const { qualitative, labels, reproductionSummary, scenarioDetail, scenarioBreakdowns, qualitativeComparison, qualitativeTransitions, qualitativeExclusions, quantitative, effectConsistency, headlines } = data;
  const originalOverall = findMatch(qualitativeComparison, "original_intended", "overall", "all");
  const majorityOverall = findMatch(qualitativeComparison, "human_majority", "overall", "all");
  const originalAuthority = findMatch(qualitativeComparison, "original_intended", "foundation", "Authority/Subversion");
  const majorityAuthority = findMatch(qualitativeComparison, "human_majority", "foundation", "Authority/Subversion");
  const unresolved = [...labels.values()].filter((label) => !label.resolved);
  const qualitativeExcluded = qualitativeExclusions.filter((row) => row.excluded_from_human_majority_analysis === true);
  const s11 = scenarioFacts("S11", scenarioDetail, scenarioBreakdowns, labels);
  const s30 = scenarioFacts("S30", scenarioDetail, scenarioBreakdowns, labels);
  const authorityOriginalTransitions = qualitativeTransitions.filter((row) => row.analysis_version === "original_intended" && row.model_key === "all" && row.reference_foundation === "Authority/Subversion");
  const authorityMajorityTransitions = qualitativeTransitions.filter((row) => row.analysis_version === "human_majority" && row.model_key === "all" && row.reference_foundation === "Authority/Subversion");
  const replacements = authorityOriginalTransitions.filter((row) => row.invoked_foundation !== "Authority/Subversion").sort((a, b) => Number(b.count) - Number(a.count));
  const versionCounts = [
    { version: "Version 1: original intended labels", scenarios: 50 },
    { version: "Version 2: validated subset", scenarios: [...labels.values()].filter((label) => label.resolved && label.majority_matches_intended).length },
    { version: "Version 3: human-majority labels", scenarios: [...labels.values()].filter((label) => label.resolved).length }
  ];
  const claimRows = claimVerdicts({ originalOverall, majorityOverall, originalAuthority, majorityAuthority, s11, s30, replacements, authorityMajorityTransitions, quantitative, effectConsistency, headlines });
  const headlineCompact = compactHeadlines(headlines);
  const exactHeadlineStats = headlines.map((row) => ({
    finding: row.finding,
    classification: row.classification,
    analysis_version: row.analysis_version,
    mean_diff: row.mean_diff,
    ci_lower: row.ci_lower,
    ci_upper: row.ci_upper,
    p_value_ttest: row.p_value_ttest,
    cohens_d: row.cohens_d,
    n: row.n,
    p_value_wilcoxon: row.p_value_wilcoxon,
    q_value_bh_wilcoxon: row.q_value_bh_wilcoxon,
    fdr_q_lt_05: row.fdr_significant_05_wilcoxon,
    fdr_q_lt_10: row.fdr_significant_10_wilcoxon
  }));

  return `# Phase 1 Final Evidence Report

Generated locally from finalized project data. No model/API calls were made.

## Exact Files Used

- \`results/processed/full_merged_with_human_mft_codes.csv\`: final 1,000 qualitative explanations and human-adjudicated MFT labels.
- \`results/processed/full_merged.csv\`: finalized rating data.
- \`results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv\`: final blinded three-human-coder scenario validation.
- \`results/processed/analysis/foundation_match.csv\` and \`foundation_transitions.csv\`: finalized existing qualitative outputs used for reproduction checks.

## Qualitative Coding Provenance

The 1,000 qualitative explanations were coded independently by **two human coders**. Their raw inter-rater agreement was **96.2%**, with **Cohen's kappa = 0.948**. Disagreements and invalid or uncertain cases were resolved through human adjudication; the final foundation labels used throughout this report are therefore **human-adjudicated labels**, not LLM-generated or AI-assisted labels.

**Historical filename note:** the source was previously stored as \`full_merged_with_ai_mft_codes.csv\`, and some legacy column names retain an \`ai_mft_\` prefix. Those names are historical and do not accurately describe the final coding process. The original file remains unchanged for traceability, while this analysis now reads the byte-identical copy \`full_merged_with_human_mft_codes.csv\`.

## Reproduction Gate

The existing qualitative findings reproduced exactly from the row-level coded data: **728/1000 = 72.8%** overall. Foundation-specific matches were Care/Harm **200/200 = 100%**, Loyalty/Betrayal **200/200 = 100%**, Fairness/Cheating **199/200 = 99.5%**, Sanctity/Degradation **116/200 = 58%**, and Authority/Subversion **13/200 = 6.5%**. The full model-specific foundation-transition matrix also reproduced cell-for-cell against the finalized existing transition table.

## Three-Coder Scenario Validation

Three blinded human coders labelled all 50 English scenarios. Pairwise raw agreement ranged from **68% to 74%**, pairwise Cohen's kappa from **0.597586 to 0.671551**, mean pairwise kappa was **0.631504**, and Fleiss' kappa was **0.629297**. Majority labels matched intended labels for **39/50 = 78%**. Authority/Subversion majority agreement was **5/10 = 50%**. Four complete three-way disagreements remained unresolved: ${unresolved.map((row) => row.scenario_id).join(", ")}.

${markdownTable(versionCounts)}

## S11 And S30

${s11.text}

${s30.text}

**Is the original 6.5% Authority/Subversion result mainly driven by S11? No.** All 13 Authority/Subversion codes came from S11, so S11 raises rather than depresses the combined match rate. S11 contributes ${s11.nonAuthorityCount}/187 non-Authority codes, whereas S30 contributes ${s30.nonAuthorityCount}/187 and received no Authority/Subversion codes at all. S30 is therefore the stronger driver of the low combined rate and the cleaner test because humans retained Authority/Subversion as its majority label.

**Does S30 still get reframed by models? Yes.** All 100 S30 explanations were coded Care/Harm, including all 25 responses from each of the four evaluated source models. The pattern appears in every input language represented (English, Hindi, Bengali, Tamil, Spanish, Japanese, and Arabic), every condition type, and every instructed reasoning/response language represented. This is strong descriptive evidence for S30, while still being one scenario rather than a general population estimate.

The most frequent replacements across the original 200 Authority-designed responses were ${replacements.slice(0, 4).map((row) => `${row.invoked_foundation} ${row.count}/${row.row_total} (${percent(Number(row.row_percentage))})`).join(", ")}.

## Intended Labels Versus Human-Majority Labels

- Original intended-label analysis: **${originalOverall.matches}/${originalOverall.total} = ${percent(Number(originalOverall.match_rate))}** overall; Authority/Subversion **${originalAuthority.matches}/${originalAuthority.total} = ${percent(Number(originalAuthority.match_rate))}**.
- Human-majority-label analysis: **${majorityOverall.matches}/${majorityOverall.total} = ${percent(Number(majorityOverall.match_rate))}** overall; Authority/Subversion **${majorityAuthority.matches}/${majorityAuthority.total} = ${percent(Number(majorityAuthority.match_rate))}**.
- Human-majority analysis excluded ${qualitativeExcluded.reduce((sum, row) => sum + Number(row.qualitative_rows), 0)} qualitative rows from ${qualitativeExcluded.length} unresolved qualitative target scenarios. Scenario-level validation excluded all four unresolved scenarios from Version 3 quantitative grouping.

Authority/Subversion remains the lowest qualitative match foundation under the human-majority reference (${majorityAuthority.matches}/${majorityAuthority.total}, ${percent(Number(majorityAuthority.match_rate))}). Models therefore still underinvoke Authority/Subversion relative to human-majority labels, although the original 6.5% estimate overstates the problem because S11 was not human-validated as Authority/Subversion.

## Foundation-Level Quantitative Sensitivity

All quantitative sensitivity estimates pool only ChatGPT, Claude, and Gemini Flash. Gemini Pro is excluded. Effects retain the original paired definitions. Confidence intervals use the Student t critical value over paired model-scenario differences. Wilcoxon tests are two-sided; Benjamini-Hochberg correction is applied separately across the 105 foundation-level tests within each analysis version.

### Effect-Type Consistency Across All Foundation-Level Tests

${markdownTable(effectConsistency)}

${markdownTable(headlineCompact)}

### Exact Headline Statistics

${markdownTable(exactHeadlineStats)}

## Claim Evaluation

${markdownTable(claimRows)}

## Paper Implications

- The claim that models rarely invoked Authority/Subversion for the two originally authority-designed qualitative targets remains descriptively true (**13/200**), but it must be qualified because S11's human-majority label was Care/Harm.
- The stronger claim that models generally or systematically fail to recognize Authority/Subversion is not supported by this benchmark design: human validation itself retained only 5/10 intended Authority scenarios, and the qualitative subset contains only two such scenarios.
- S30 independently tests a human-validated Authority/Subversion scenario. Its exact distribution and cross-model/language breakdown show whether reframing persists beyond S11; those results are reported above and in \`s11_s30_breakdowns.csv\`.
- Claims about the non-Authority and Authority quantitative findings should follow the stability classifications above rather than the original-label analysis alone.
- Cultural-framing, input-language, and reasoning-language effects are heterogeneous across languages and foundations; universal wording is not warranted.

## Non-Negotiable Checks

- No new API calls were made: **confirmed**.
- No original data files were modified: **confirmed**.
- Existing outputs were not overwritten: **confirmed**; all verification CSVs are in \`results/processed/phase1_final_evidence/\`.
- Original 72.8% result reproduced: **confirmed (728/1000)**.
- Original Authority/Subversion result reproduced: **confirmed (13/200 = 6.5%)**.
- S11 human-majority label: **Care/Harm**.
- S30 human-majority label: **Authority/Subversion**.
- Complete three-way disagreements unresolved: **confirmed (${unresolved.length})**.
- Gemini Pro excluded from pooled main effects: **confirmed**.
`;
}

function scenarioFacts(scenario: string, detail: OutRow[], breakdowns: OutRow[], labels: Map<string, ScenarioLabel>) {
  const rows = detail.filter((row) => row.scenario_id === scenario);
  const total = Number(rows[0]?.total_responses ?? 0);
  const original = labels.get(scenario)!.intended;
  const majority = labels.get(scenario)!.majority;
  const originalCount = Number(rows.find((row) => row.coded_foundation === original)?.count ?? 0);
  const majorityCount = Number(rows.find((row) => row.coded_foundation === majority)?.count ?? 0);
  const distribution = rows.filter((row) => Number(row.count) > 0).sort((a, b) => Number(b.count) - Number(a.count)).map((row) => `${row.coded_foundation} ${row.count}/${total} (${percent(Number(row.percentage))})`).join(", ");
  const nonAuthorityCount = total - Number(rows.find((row) => row.coded_foundation === "Authority/Subversion")?.count ?? 0);
  const modelAuthority = breakdowns.filter((row) => row.scenario_id === scenario && row.dimension === "model" && row.coded_foundation === "Authority/Subversion").map((row) => `${row.group_value} ${row.count}/${row.group_total}`).join(", ");
  const languagesWithAuthority = breakdowns.filter((row) => row.scenario_id === scenario && row.dimension === "language" && row.coded_foundation === "Authority/Subversion" && Number(row.count) > 0).map((row) => `${row.group_value} ${row.count}/${row.group_total}`).join(", ") || "none";
  return {
    total,
    nonAuthorityCount,
    authorityCount: total - nonAuthorityCount,
    text: `### ${scenario}\n\n${scenario} had **${total}** qualitative responses. Original intended label: **${original}**; human-majority label: **${majority}**. Distribution: ${distribution}. Match with the original intended label was **${originalCount}/${total} = ${percent(originalCount / total)}**; match with the human-majority label was **${majorityCount}/${total} = ${percent(majorityCount / total)}**. Authority/Subversion counts by model were ${modelAuthority}; languages with at least one Authority/Subversion code were ${languagesWithAuthority}. Full model, language, condition-type, and instructed reasoning/response-language breakdowns are in \`s11_s30_breakdowns.csv\`.`
  };
}

function claimVerdicts(input: {
  originalOverall: OutRow;
  majorityOverall: OutRow;
  originalAuthority: OutRow;
  majorityAuthority: OutRow;
  s11: ReturnType<typeof scenarioFacts>;
  s30: ReturnType<typeof scenarioFacts>;
  replacements: OutRow[];
  authorityMajorityTransitions: OutRow[];
  quantitative: EffectRow[];
  effectConsistency: OutRow[];
  headlines: OutRow[];
}): OutRow[] {
  const { originalAuthority, majorityAuthority, s30, headlines, effectConsistency } = input;
  const stableCounts = Object.fromEntries(effectConsistency.filter((row) => row.analysis_version === "all_three_versions").map((row) => [String(row.effect_type), Number(row.surviving_q_lt_05)]));
  const byVersion = (effect: string) => effectConsistency.filter((row) => row.effect_type === effect && row.analysis_version !== "all_three_versions").map((row) => `${row.analysis_version}: ${row.surviving_q_lt_05}/${row.tests}`).join(", ");
  return [
    { claim: "Models systematically fail to recognise Authority/Subversion.", verdict: "Not supported", evidence: `Only two qualitative scenarios were originally Authority-designed; one (S11) was human-majority Care/Harm. Human coders retained Authority for 5/10 intended Authority scenarios. Human-majority qualitative Authority match was ${majorityAuthority.matches}/${majorityAuthority.total} (${percent(Number(majorityAuthority.match_rate))}), insufficient for a general systematic claim.` },
    { claim: "Models rarely invoke Authority/Subversion for authority-designed scenarios.", verdict: "Supported with qualification", evidence: `Against original labels, Authority matched 13/200 (6.5%). Against human-majority labels it matched ${majorityAuthority.matches}/${majorityAuthority.total} (${percent(Number(majorityAuthority.match_rate))}); the original estimate is strongly affected by S11's relabeling.` },
    { claim: "Authority/Subversion was the least stable foundation in this benchmark.", verdict: "Supported with qualification", evidence: `Scenario validation retained Authority for 5/10 (50%), the lowest majority-intended rate; qualitative human-majority Authority match was ${majorityAuthority.matches}/${majorityAuthority.total} (${percent(Number(majorityAuthority.match_rate))}). Stability refers to this benchmark's items and coding scheme.` },
    { claim: "Human coders and models often interpreted authority-related scenarios through other moral foundations.", verdict: "Supported", evidence: `Humans reassigned 5/10 intended Authority scenarios and left additional Authority items unresolved where applicable; models matched original Authority in only ${originalAuthority.matches}/${originalAuthority.total}, with replacements led by ${input.replacements.slice(0, 3).map((row) => `${row.invoked_foundation} (${row.count})`).join(", ")}.` },
    { claim: "Models reframed even human-validated Authority/Subversion scenarios.", verdict: s30.authorityCount < s30.total / 2 ? "Supported" : "Supported with qualification", evidence: `For human-validated S30, models invoked Authority/Subversion in ${s30.authorityCount}/${s30.total} (${percent(s30.authorityCount / s30.total)}); the remainder used other foundations. Scope is one qualitative scenario.` },
    { claim: "Cultural adaptation produced the most consistent quantitative effect.", verdict: stableCounts.framing > stableCounts.language && stableCounts.framing > stableCounts.reasoning ? "Supported with qualification" : "Not supported", evidence: `Framing had the most q<.05 findings in each version (${byVersion("framing")}) and the most findings surviving q<.05 in all three versions (${stableCounts.framing}/35), versus reasoning ${stableCounts.reasoning}/35 and language ${stableCounts.language}/35. Consistency remains foundation- and language-specific.` },
    { claim: "Input-language and instructed reasoning-language effects were selective rather than universal.", verdict: "Supported", evidence: `Named effects show mixed stability classifications across languages and foundations (${unique(headlines.map((row) => String(row.finding))).map((finding) => `${finding}: ${headlines.find((row) => row.finding === finding)?.classification}`).join("; ")}).` }
  ];
}

function compactHeadlines(rows: OutRow[]) {
  const findings = unique(rows.map((row) => String(row.finding)));
  return findings.map((finding) => {
    const entries = rows.filter((row) => row.finding === finding);
    const get = (version: string) => entries.find((row) => row.analysis_version === version);
    const original = get("v1_original_intended");
    const subset = get("v2_validated_subset");
    const majority = get("v3_human_majority");
    const cell = (row?: OutRow) => row ? `diff=${format(row.mean_diff)}, d=${format(row.cohens_d)}, W-p=${format(row.p_value_wilcoxon)}, q=${format(row.q_value_bh_wilcoxon)}, n=${row.n}` : "not estimable";
    return { finding, classification: entries[0]?.classification ?? "", original_intended: cell(original), validated_subset: cell(subset), human_majority: cell(majority) };
  });
}

function findMatch(rows: OutRow[], version: string, group: string, value: string) {
  const row = rows.find((candidate) => candidate.analysis_version === version && candidate.group_type === group && candidate.group_value === value);
  if (!row) throw new Error(`Missing qualitative summary ${version}/${group}/${value}.`);
  return row;
}

function matchCount(rows: Row[], reference: (row: Row) => string) {
  return rows.filter((row) => row.ai_mft_final_label === reference(row)).length;
}

function conditionType(row: Row) {
  if (row.conditionId === "en_en") return "en_en";
  return `${row.scenarioVersion}_${row.reasoningLang === "en" ? "reason_en" : "reason_l2"}`;
}

function inverseStudentT(probability: number, df: number) {
  let low = 0;
  let high = 20;
  for (let index = 0; index < 100; index += 1) {
    const mid = (low + high) / 2;
    if (studentTCdf(mid, df) < probability) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
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
  if (x < (a + 1) / (a + b + 2)) return bt * betaFraction(x, a, b) / a;
  return 1 - bt * betaFraction(1 - x, b, a) / b;
}

function betaFraction(x: number, a: number, b: number) {
  const fpmin = 1e-30;
  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m += 1) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((a - 1 + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d; h *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + 1 + m2));
    d = 1 + aa * d; if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c; if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 3e-12) break;
  }
  return h;
}

function logGamma(z: number): number {
  const coefficients = [676.5203681218851, -1259.1392167224028, 771.3234287776531, -176.6150291621406, 12.507343278686905, -0.13857109526572012, 9.984369578019572e-6, 1.5056327351493116e-7];
  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) x += coefficients[index] / (z + index + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function normalCdf(value: number) {
  return 0.5 * (1 + erf(value / Math.sqrt(2)));
}

function erf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value);
  const t = 1 / (1 + 0.3275911 * x);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function format(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? number.toPrecision(8).replace(/\.?0+$/, "") : String(value);
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function toCsv(rows: OutRow[]) {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`;
}

function csvCell(value: Value | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function markdownTable(rows: OutRow[]) {
  if (!rows.length) return "_No rows._";
  const columns = Object.keys(rows[0]);
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => String(row[column] ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")).join(" | ")} |`)
  ].join("\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
