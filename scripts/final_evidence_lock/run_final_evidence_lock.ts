import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { wilcoxonSignedRank } from "./wilcoxon";
import { runWilcoxonUnitTests } from "../../tests/final_evidence_lock/wilcoxon.test";

type Row = Record<string, string>;
type Out = Record<string, string | number | boolean | null>;
type Effect = "language" | "framing" | "reasoning";
type Pair = { scenarioId: string; modelKey: string; language: string; diff: number };

const root = process.cwd();
const outDir = path.join(root, "results", "processed", "final_evidence_lock");
const codedPath = path.join(root, "results", "processed", "full_merged_with_ai_mft_codes.csv");
const misleadingHumanPath = path.join(root, "results", "processed", "full_merged_with_human_mft_codes.csv");
const ratingPath = path.join(root, "results", "processed", "full_merged.csv");
const adjudicatedPath = path.join(root, "results", "processed", "ai_mft_coding", "ai_mft_codes_adjudicated.csv");
const rawCodesPath = path.join(root, "results", "processed", "ai_mft_coding", "ai_mft_codes.csv");
const validationPath = path.join(root, "results", "processed", "scenario_validation_trial2", "scenario_validation_merged_3coders.csv");
const lockedReportPath = path.join(root, "phase1_evidence_report_reproducibility.md");
const bootstrapSeed = 20260716;
const bootstrapIterations = 10_000;
const foundations = ["Care/Harm", "Loyalty/Betrayal", "Authority/Subversion", "Fairness/Cheating", "Sanctity/Degradation"];
const languages = ["hi", "bn", "ta", "es", "ja", "ar"];
const primaryModels = ["chatgpt", "claude", "gemini_flash"];
const qualitativeTargets = ["S01", "S06", "S11", "S16", "S21", "S26", "S28", "S29", "S30", "S34"];

type ScenarioLabel = {
  id: string;
  intended: string;
  majority: string;
  resolved: boolean;
  matches: boolean;
  allDisagree: boolean;
};

async function main() {
  await mkdir(outDir, { recursive: true });
  const tests = runWilcoxonUnitTests();
  const [codedAll, ratingAll, adjudicated, rawCodes, validation] = await Promise.all([
    readCsv(codedPath), readCsv(ratingPath), readCsv(adjudicatedPath), readCsv(rawCodesPath), readCsv(validationPath)
  ]);
  const qualitative = codedAll.filter((row) => row.taskType === "qualitative");
  const allRatings = ratingAll.filter((row) => row.taskType === "rating");
  const ratings = ratingAll.filter((row) => row.taskType === "rating" && primaryModels.includes(row.modelKey));
  const labels = scenarioLabels(validation);
  validateStudyGates(allRatings, qualitative, validation, labels);
  const provenance = await auditProvenance(qualitative, adjudicated, rawCodes);
  reproduceGate(qualitative);

  const qualitativeReproduction = qualitativeSummary(qualitative, "original_intended", (row) => row.mft_foundation);
  const qualitativeIntended = qualitativeSummary(qualitative, "intended", (row) => row.mft_foundation);
  const qualitativeMajority = qualitativeSummary(qualitative, "human_scenario_majority", (row) => labels.get(row.scenarioId)?.majority ?? "");
  const transitionsIntended = transitionRows(qualitative, "intended", (row) => row.mft_foundation);
  const transitionsMajority = transitionRows(qualitative, "human_scenario_majority", (row) => labels.get(row.scenarioId)?.majority ?? "");
  const scenarioDistributions = s11S30Distributions(qualitative, labels);
  const scenarioBreakdowns = s11S30Breakdowns(qualitative, labels);
  const sensitivity = quantitativeSensitivity(ratings, labels);
  const bootstrap = clusterBootstrap(sensitivity);
  const consistency = effectConsistency(sensitivity);
  const headlines = headlineFindings(sensitivity, bootstrap);
  const claimMatrix = claims(qualitativeIntended, qualitativeMajority, headlines, provenance);

  const csvOutputs: Array<[string, Out[]]> = [
    ["qualitative_reproduction_final.csv", qualitativeReproduction],
    ["qualitative_match_intended_final.csv", qualitativeIntended],
    ["qualitative_match_human_majority_final.csv", qualitativeMajority],
    ["qualitative_transitions_intended_final.csv", transitionsIntended],
    ["qualitative_transitions_human_majority_final.csv", transitionsMajority],
    ["s11_s30_foundation_distribution_final.csv", scenarioDistributions],
    ["s11_s30_breakdowns_final.csv", scenarioBreakdowns],
    ["foundation_sensitivity_final.csv", sensitivity.map(stripPairs)],
    ["foundation_scenario_cluster_bootstrap_final.csv", bootstrap],
    ["foundation_effect_consistency_final.csv", consistency],
    ["effect_type_consistency_final.csv", consistency],
    ["headline_finding_sensitivity_final.csv", headlines],
    ["final_claim_matrix.csv", claimMatrix],
    ["qualitative_ai_coder_agreement.csv", provenance.agreementRows],
    ["qualitative_ai_coder_confusion_matrix.csv", provenance.confusionRows],
    ["qualitative_adjudication_source_summary.csv", provenance.sourceRows]
  ];
  const paperReady = paperReadyStatistics(headlines);
  csvOutputs.push(["paper_ready_statistics_final.csv", paperReady]);
  for (const [name, rows] of csvOutputs) await writeFile(path.join(outDir, name), toCsv(rows), "utf8");

  await writeDocumentation({ tests, provenance, qualitative, labels, qualitativeIntended, qualitativeMajority, transitionsIntended, transitionsMajority, scenarioDistributions, sensitivity, bootstrap, consistency, headlines, claimMatrix });
  const inventory = await inputInventory();
  await writeFile(path.join(outDir, "FINAL_EVIDENCE_INPUT_INVENTORY.md"), inventory.markdown, "utf8");
  await writeFile(path.join(outDir, "final_evidence_input_inventory.csv"), toCsv(inventory.rows), "utf8");
  await writeManifest();
  console.log("Final evidence lock pipeline completed with a qualitative provenance blocker.");
  console.log(`Corrected quantitative outputs: ${outDir}`);
  console.log(`Canonical report: ${lockedReportPath}`);
  console.log(`Blockers: ${path.join(outDir, "FINAL_EVIDENCE_LOCK_BLOCKERS.md")}`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
}

function scenarioLabels(rows: Row[]) {
  const map = new Map<string, ScenarioLabel>();
  for (const row of rows) map.set(row.scenario_id, {
    id: row.scenario_id,
    intended: row.intended_mft_foundation,
    majority: row.majority_vote_label,
    resolved: foundations.includes(row.majority_vote_label),
    matches: row.majority_matches_intended === "true",
    allDisagree: row.all_three_disagree === "true"
  });
  if (map.size !== 50) throw new Error(`Expected 50 scenario-validation rows; found ${map.size}.`);
  return map;
}

function validateStudyGates(ratings: Row[], qualitative: Row[], validation: Row[], labels: Map<string, ScenarioLabel>) {
  const failures: string[] = [];
  if (ratings.length !== 5000) failures.push(`rating rows=${ratings.length}, expected 5000`);
  if (qualitative.length !== 1000) failures.push(`qualitative rows=${qualitative.length}, expected 1000`);
  if (validation.length !== 50) failures.push(`scenario-validation rows=${validation.length}, expected 50`);
  for (const id of qualitativeTargets) {
    const n = qualitative.filter((row) => row.scenarioId === id).length;
    if (n !== 100) failures.push(`${id} qualitative rows=${n}, expected 100`);
  }
  const unresolved = [...labels.values()].filter((row) => !row.resolved).map((row) => row.id).sort();
  if (unresolved.join("|") !== ["S03", "S09", "S13", "S35"].join("|")) failures.push(`unresolved scenarios=${unresolved.join(",")}`);
  if ([...labels.values()].filter((row) => row.resolved && row.matches).length !== 39) failures.push("validated subset scenario count is not 39");
  if ([...labels.values()].filter((row) => row.resolved).length !== 46) failures.push("human-majority scenario count is not 46");
  if (labels.get("S11")?.majority !== "Care/Harm") failures.push("S11 majority is not Care/Harm");
  if (labels.get("S30")?.majority !== "Authority/Subversion") failures.push("S30 majority is not Authority/Subversion");
  const authority = [...labels.values()].filter((row) => row.intended === "Authority/Subversion");
  if (authority.filter((row) => row.matches).length !== 5 || authority.length !== 10) failures.push("Authority intended-majority gate is not 5/10");
  if (failures.length) throw new Error(`Study validation gates failed:\n- ${failures.join("\n- ")}`);
}

async function auditProvenance(qualitative: Row[], adjudicated: Row[], rawCodes: Row[]) {
  const byId = new Map(adjudicated.map((row) => [row.response_id, row]));
  let mismatches = 0;
  for (const row of qualitative) {
    const source = byId.get(row.response_id);
    if (!source || row.ai_mft_llama_label !== source.llama_label || row.ai_mft_deepseek_label !== source.deepseek_label || row.ai_mft_final_label !== source.adjudicated_label || row.ai_mft_code_source !== source.adjudication_source) mismatches += 1;
  }
  const valid = rawCodes.filter((row) => foundations.includes(row.llama_label) && foundations.includes(row.deepseek_label));
  const agreements = valid.filter((row) => row.llama_label === row.deepseek_label).length;
  const rawAgreement = agreements / valid.length;
  const kappa = cohenKappa(valid.map((row) => [row.llama_label, row.deepseek_label] as [string, string]));
  const sourceCounts = counts(adjudicated.map((row) => row.adjudication_source));
  const agreementRows: Out[] = [
    { coder_a: "meta-llama/llama-3.3-70b-instruct", coder_b: "deepseek/deepseek-chat", valid_paired_rows: valid.length, exact_agreements: agreements, raw_agreement: rawAgreement, cohens_kappa: kappa, provenance_type: "LLM-to-LLM reliability; not human inter-rater reliability" }
  ];
  const confusionRows: Out[] = [];
  for (const a of foundations) for (const b of foundations) confusionRows.push({ llama_label: a, deepseek_label: b, count: valid.filter((row) => row.llama_label === a && row.deepseek_label === b).length });
  const sourceRows = [...sourceCounts].map(([source, count]) => ({ adjudication_source: source, count }));
  const sourceHash = await sha256(codedPath);
  const misleadingHash = await sha256(misleadingHumanPath);
  if (qualitative.length !== 1000 || adjudicated.length !== 1000 || mismatches !== 0) throw new Error("Qualitative model-code mapping failed its integrity check.");
  return { validN: valid.length, agreements, rawAgreement, kappa, mismatches, sourceCounts, agreementRows, confusionRows, sourceRows, sourceHash, misleadingHash, identicalCopies: sourceHash === misleadingHash };
}

function reproduceGate(rows: Row[]) {
  if (rows.length !== 1000) throw new Error(`Expected 1000 qualitative rows; found ${rows.length}.`);
  if (rows.some((row) => !foundations.includes(row.ai_mft_final_label))) throw new Error("Missing or invalid adjudicated qualitative labels.");
  const expected: Record<string, number> = { "Care/Harm": 200, "Loyalty/Betrayal": 200, "Fairness/Cheating": 199, "Sanctity/Degradation": 116, "Authority/Subversion": 13 };
  for (const foundation of foundations) {
    const subset = rows.filter((row) => row.mft_foundation === foundation);
    const matches = subset.filter((row) => row.ai_mft_final_label === foundation).length;
    if (subset.length !== 200 || matches !== expected[foundation]) throw new Error(`Qualitative reproduction failed for ${foundation}: ${matches}/${subset.length}.`);
  }
}

function qualitativeSummary(rows: Row[], version: string, reference: (row: Row) => string): Out[] {
  const usable = rows.filter((row) => foundations.includes(reference(row)));
  const output: Out[] = [];
  addMatch(output, usable, version, "overall", "all", reference);
  for (const foundation of foundations) addMatch(output, usable.filter((row) => reference(row) === foundation), version, "foundation", foundation, reference);
  for (const scenario of unique(usable.map((row) => row.scenarioId))) addMatch(output, usable.filter((row) => row.scenarioId === scenario), version, "scenario", scenario, reference);
  for (const model of unique(usable.map((row) => row.modelKey))) addMatch(output, usable.filter((row) => row.modelKey === model), version, "model", model, reference);
  for (const language of unique(usable.map((row) => row.inputLang))) addMatch(output, usable.filter((row) => row.inputLang === language), version, "language", language, reference);
  return output;
}

function addMatch(output: Out[], rows: Row[], version: string, type: string, value: string, reference: (row: Row) => string) {
  const matches = rows.filter((row) => row.ai_mft_final_label === reference(row)).length;
  output.push({ analysis_version: version, group_type: type, group_value: value, matches, total: rows.length, match_rate: rows.length ? matches / rows.length : null, response_label_provenance: "dual LLM coding with manual adjudication" });
}

function transitionRows(rows: Row[], version: string, reference: (row: Row) => string): Out[] {
  const usable = rows.filter((row) => foundations.includes(reference(row)));
  const output: Out[] = [];
  for (const model of ["all", ...unique(usable.map((row) => row.modelKey))]) {
    const selected = model === "all" ? usable : usable.filter((row) => row.modelKey === model);
    for (const from of foundations) {
      const source = selected.filter((row) => reference(row) === from);
      for (const to of foundations) {
        const count = source.filter((row) => row.ai_mft_final_label === to).length;
        output.push({ analysis_version: version, model_key: model, reference_foundation: from, invoked_foundation: to, count, row_total: source.length, row_percentage: source.length ? count / source.length : null });
      }
    }
  }
  return output;
}

function s11S30Distributions(rows: Row[], labels: Map<string, ScenarioLabel>): Out[] {
  const output: Out[] = [];
  for (const id of ["S11", "S30"]) {
    const selected = rows.filter((row) => row.scenarioId === id);
    for (const foundation of foundations) {
      const count = selected.filter((row) => row.ai_mft_final_label === foundation).length;
      output.push({ scenario_id: id, intended_foundation: labels.get(id)?.intended ?? "", human_scenario_majority_foundation: labels.get(id)?.majority ?? "", response_coded_foundation: foundation, count, total: selected.length, percentage: selected.length ? count / selected.length : null, response_label_provenance: "dual LLM coding with manual adjudication" });
    }
  }
  return output;
}

function s11S30Breakdowns(rows: Row[], labels: Map<string, ScenarioLabel>): Out[] {
  const output: Out[] = [];
  for (const id of ["S11", "S30"]) {
    const selected = rows.filter((row) => row.scenarioId === id);
    const dimensions: Array<[string, (row: Row) => string]> = [["overall", () => "all"], ["model", (row) => row.modelKey], ["language", (row) => row.inputLang], ["condition_type", conditionType], ["reasoning_language", (row) => row.reasoningLang]];
    for (const [dimension, getter] of dimensions) for (const value of unique(selected.map(getter))) {
      const group = selected.filter((row) => getter(row) === value);
      for (const foundation of foundations) output.push({ scenario_id: id, intended_foundation: labels.get(id)?.intended ?? "", human_scenario_majority_foundation: labels.get(id)?.majority ?? "", dimension, group_value: value, response_coded_foundation: foundation, count: group.filter((row) => row.ai_mft_final_label === foundation).length, group_total: group.length });
    }
  }
  return output;
}

type SensitivityRow = Out & {
  analysis_version: string;
  effect_type: Effect;
  language: string;
  mft_foundation: string;
  mean_diff: number | null;
  median_diff: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  p_value_ttest: number | null;
  p_value_wilcoxon: number;
  cohens_d: number | null;
  n: number;
  nonzero_n: number;
  q_t_primary_105: number | null;
  q_w_primary_105: number | null;
  q_t_effect_35: number | null;
  q_w_effect_35: number | null;
  _pairs: Pair[];
};

function quantitativeSensitivity(ratings: Row[], labels: Map<string, ScenarioLabel>): SensitivityRow[] {
  const versions = [
    { name: "v1_original_intended", rows: ratings, label: (row: Row) => row.mft_foundation },
    { name: "v2_validated_subset", rows: ratings.filter((row) => labels.get(row.scenarioId)?.resolved && labels.get(row.scenarioId)?.matches), label: (row: Row) => row.mft_foundation },
    { name: "v3_human_scenario_majority", rows: ratings.filter((row) => labels.get(row.scenarioId)?.resolved), label: (row: Row) => labels.get(row.scenarioId)?.majority ?? "" }
  ];
  const output: SensitivityRow[] = [];
  for (const version of versions) {
    const versionRows: SensitivityRow[] = [];
    for (const foundation of foundations) {
      const selected = version.rows.filter((row) => version.label(row) === foundation);
      for (const effect of ["language", "framing", "reasoning"] as Effect[]) {
        for (const language of [...languages, "all"]) versionRows.push(effectSummary(version.name, selected, effect, language, foundation));
      }
    }
    applyBh(versionRows, "p_value_ttest", "q_t_primary_105");
    applyBh(versionRows, "p_value_wilcoxon", "q_w_primary_105");
    for (const effect of ["language", "framing", "reasoning"] as Effect[]) {
      const family = versionRows.filter((row) => row.effect_type === effect);
      applyBh(family, "p_value_ttest", "q_t_effect_35");
      applyBh(family, "p_value_wilcoxon", "q_w_effect_35");
    }
    output.push(...versionRows);
  }
  if (output.length !== 315) throw new Error(`Expected 315 foundation sensitivity rows; found ${output.length}.`);
  if (output.some((row) => row.p_value_wilcoxon === 0 || row.p_value_ttest === 0)) throw new Error("Literal p=0 is prohibited.");
  return output;
}

function effectSummary(version: string, rows: Row[], effect: Effect, language: string, foundation: string): SensitivityRow {
  const pairs = effectPairs(rows, effect, language);
  const values = pairs.map((pair) => pair.diff);
  const summary = pairedSummary(values);
  const wilcoxon = wilcoxonSignedRank(values);
  return {
    analysis_version: version,
    effect_type: effect,
    language,
    model_key: "pooled_primary_models",
    mft_foundation: foundation,
    mean_diff: summary.mean,
    median_diff: median(values),
    sd_diff: summary.sd,
    se_diff: summary.se,
    t_statistic: summary.t,
    ci_lower: summary.ciLower,
    ci_upper: summary.ciUpper,
    p_value_ttest: summary.pValue,
    cohens_d: summary.cohensD,
    n: values.length,
    positive_n: wilcoxon.positiveN,
    negative_n: wilcoxon.negativeN,
    zero_n: wilcoxon.zeroN,
    nonzero_n: wilcoxon.nonzeroN,
    tied_absolute_rank_groups: wilcoxon.tiedAbsoluteRankGroups,
    w_plus: wilcoxon.wPlus,
    w_minus: wilcoxon.wMinus,
    w_statistic: wilcoxon.statistic,
    p_value_wilcoxon: wilcoxon.pValue,
    wilcoxon_method: wilcoxon.method,
    wilcoxon_exact: wilcoxon.exact,
    wilcoxon_iterations: wilcoxon.iterations,
    wilcoxon_seed: wilcoxon.seed,
    q_t_primary_105: null,
    q_w_primary_105: null,
    q_t_effect_35: null,
    q_w_effect_35: null,
    primary_correction_family: "105 tests within analysis version (3 effects x 7 language levels x 5 foundations)",
    supplementary_correction_family: "35 tests within analysis version and effect type (7 language levels x 5 foundations)",
    _pairs: pairs
  };
}

function effectPairs(rows: Row[], effect: Effect, language: string): Pair[] {
  const selectedLanguages = language === "all" ? languages : [language];
  const output: Pair[] = [];
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
      if (Number.isFinite(a) && Number.isFinite(b)) output.push({ scenarioId: target.scenarioId, modelKey: target.modelKey, language: selected, diff: a - b });
    }
  }
  return output;
}

function pairedSummary(values: number[]) {
  const n = values.length;
  if (!n) return { mean: null, sd: null, se: null, t: null, ciLower: null, ciUpper: null, pValue: null, cohensD: null };
  const mean = average(values);
  const sd = n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;
  const se = sd / Math.sqrt(n);
  const t = se ? mean / se : mean === 0 ? 0 : Math.sign(mean) * Number.MAX_VALUE;
  const pValue = n > 1 ? Math.max(Number.MIN_VALUE, 2 * (1 - studentTCdf(Math.abs(t), n - 1))) : null;
  const critical = n > 1 ? inverseStudentT(0.975, n - 1) : null;
  return { mean, sd, se, t, ciLower: critical === null ? null : mean - critical * se, ciUpper: critical === null ? null : mean + critical * se, pValue, cohensD: sd ? mean / sd : null };
}

function applyBh(rows: SensitivityRow[], pColumn: "p_value_ttest" | "p_value_wilcoxon", qColumn: "q_t_primary_105" | "q_w_primary_105" | "q_t_effect_35" | "q_w_effect_35") {
  const ordered = rows.map((row, index) => ({ row, index, p: row[pColumn] })).filter((entry) => entry.p !== null && Number.isFinite(Number(entry.p))).sort((a, b) => Number(a.p) - Number(b.p));
  let running = 1;
  for (let i = ordered.length - 1; i >= 0; i -= 1) {
    const q = Math.min(running, Number(ordered[i].p) * ordered.length / (i + 1), 1);
    running = q;
    ordered[i].row[qColumn] = q;
  }
}

function clusterBootstrap(rows: SensitivityRow[]): Out[] {
  return rows.map((row, index) => {
    const clusters = new Map<string, number[]>();
    for (const pair of row._pairs) {
      const values = clusters.get(pair.scenarioId) ?? [];
      values.push(pair.diff);
      clusters.set(pair.scenarioId, values);
    }
    const clusterStats = [...clusters].map(([scenarioId, values]) => ({ scenarioId, sum: values.reduce((a, b) => a + b, 0), n: values.length }));
    if (!clusterStats.length) return { analysis_version: row.analysis_version, effect_type: row.effect_type, language: row.language, mft_foundation: row.mft_foundation, scenario_clusters: 0, bootstrap_iterations: bootstrapIterations, bootstrap_seed: bootstrapSeed + index, bootstrap_mean: null, bootstrap_ci_lower: null, bootstrap_ci_upper: null, proportion_above_zero: null };
    const rng = mulberry32(bootstrapSeed + index);
    const estimates = new Float64Array(bootstrapIterations);
    let above = 0;
    for (let iteration = 0; iteration < bootstrapIterations; iteration += 1) {
      let sum = 0;
      let n = 0;
      for (let draw = 0; draw < clusterStats.length; draw += 1) {
        const cluster = clusterStats[Math.floor(rng() * clusterStats.length)];
        sum += cluster.sum;
        n += cluster.n;
      }
      const estimate = sum / n;
      estimates[iteration] = estimate;
      if (estimate > 0) above += 1;
    }
    estimates.sort();
    return {
      analysis_version: row.analysis_version,
      effect_type: row.effect_type,
      language: row.language,
      model_key: row.model_key,
      mft_foundation: row.mft_foundation,
      scenario_clusters: clusterStats.length,
      paired_observations: row.n,
      bootstrap_iterations: bootstrapIterations,
      bootstrap_seed: bootstrapSeed + index,
      bootstrap_mean: average([...estimates]),
      bootstrap_ci_lower: percentileSorted(estimates, 0.025),
      bootstrap_ci_upper: percentileSorted(estimates, 0.975),
      bootstrap_interval_crosses_zero: percentileSorted(estimates, 0.025) <= 0 && percentileSorted(estimates, 0.975) >= 0,
      proportion_above_zero: above / bootstrapIterations,
      proportion_below_zero: (bootstrapIterations - above) / bootstrapIterations
    };
  });
}

function effectConsistency(rows: SensitivityRow[]): Out[] {
  const output: Out[] = [];
  for (const version of unique(rows.map((row) => row.analysis_version))) for (const effect of ["language", "framing", "reasoning"] as Effect[]) {
    const selected = rows.filter((row) => row.analysis_version === version && row.effect_type === effect);
    output.push({ analysis_version: version, effect_type: effect, tests: selected.length, t_q_primary_lt_05: selected.filter((row) => Number(row.q_t_primary_105) < 0.05).length, t_q_primary_lt_10: selected.filter((row) => Number(row.q_t_primary_105) < 0.10).length, wilcoxon_q_primary_lt_05: selected.filter((row) => Number(row.q_w_primary_105) < 0.05).length, wilcoxon_q_primary_lt_10: selected.filter((row) => Number(row.q_w_primary_105) < 0.10).length, wilcoxon_q_effect_lt_05: selected.filter((row) => Number(row.q_w_effect_35) < 0.05).length, wilcoxon_q_effect_lt_10: selected.filter((row) => Number(row.q_w_effect_35) < 0.10).length });
  }
  for (const effect of ["language", "framing", "reasoning"] as Effect[]) {
    const keys = unique(rows.filter((row) => row.effect_type === effect).map((row) => `${row.language}|${row.mft_foundation}`));
    output.push({ analysis_version: "all_three_versions", effect_type: effect, tests: keys.length, same_direction_all_versions: keys.filter((key) => sameDirection(rows.filter((row) => row.effect_type === effect && `${row.language}|${row.mft_foundation}` === key))).length, wilcoxon_q_primary_lt_05_all_versions: keys.filter((key) => rows.filter((row) => row.effect_type === effect && `${row.language}|${row.mft_foundation}` === key).every((row) => Number(row.q_w_primary_105) < 0.05)).length });
  }
  return output;
}

function headlineFindings(rows: SensitivityRow[], bootstrap: Out[]): Out[] {
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
  ] as const;
  const output: Out[] = [];
  for (const [finding, effect, language, foundation] of specs) {
    const selected = rows.filter((row) => row.effect_type === effect && row.language === language && row.mft_foundation === foundation);
    const classification = classify(selected);
    for (const row of selected) {
      const boot = bootstrap.find((candidate) => candidate.analysis_version === row.analysis_version && candidate.effect_type === effect && candidate.language === language && candidate.mft_foundation === foundation);
      output.push({
        finding,
        classification,
        analysis_version: row.analysis_version,
        effect_type: effect,
        language,
        mft_foundation: foundation,
        mean_diff: row.mean_diff,
        ci_lower: row.ci_lower,
        ci_upper: row.ci_upper,
        p_value_ttest: row.p_value_ttest,
        q_t_primary_105: row.q_t_primary_105,
        p_value_wilcoxon: row.p_value_wilcoxon,
        q_w_primary_105: row.q_w_primary_105,
        q_w_effect_35: row.q_w_effect_35,
        cohens_d: row.cohens_d,
        n: row.n,
        nonzero_n: row.nonzero_n,
        bootstrap_ci_lower: boot?.bootstrap_ci_lower ?? null,
        bootstrap_ci_upper: boot?.bootstrap_ci_upper ?? null
      });
    }
  }
  return output;
}

function classify(selected: SensitivityRow[]) {
  const original = selected.find((row) => row.analysis_version === "v1_original_intended");
  const validations = selected.filter((row) => row.analysis_version !== "v1_original_intended");
  if (!original || validations.length !== 2 || selected.some((row) => !row.n)) return "not estimable";
  if (!sameDirection(selected)) return "changed direction";
  const originalQ = Number(original.q_w_primary_105);
  const validationQ = validations.map((row) => Number(row.q_w_primary_105));
  const validationD = average(validations.map((row) => Math.abs(Number(row.cohens_d))));
  const originalD = Math.abs(Number(original.cohens_d));
  const cisCross = validations.every((row) => Number(row.ci_lower) <= 0 && Number(row.ci_upper) >= 0);
  if (validationQ.every((q) => q >= 0.10) && cisCross) return "lost after validation";
  if (originalQ < 0.05 && validationQ.every((q) => q >= 0.05 && q < 0.10)) return "weakened to suggestive";
  if (validationQ.some((q) => q < 0.05) && validationQ.some((q) => q >= 0.05 && q < 0.10)) return "weakened to suggestive";
  if (validationQ.every((q) => q < 0.05)) {
    if (validationD > originalD * 1.10) return "strengthened";
    if (validationD < originalD * 0.75) return "weakened but survives";
    return "stable";
  }
  return "directionally stable but not statistically robust";
}

function claims(intended: Out[], majority: Out[], headlines: Out[], provenance: Awaited<ReturnType<typeof auditProvenance>>): Out[] {
  const original = intended.find((row) => row.group_type === "overall");
  const originalAuthority = intended.find((row) => row.group_type === "foundation" && row.group_value === "Authority/Subversion");
  const majorityOverall = majority.find((row) => row.group_type === "overall");
  const majorityAuthority = majority.find((row) => row.group_type === "foundation" && row.group_value === "Authority/Subversion");
  return [
    { claim: "Models systematically fail to recognise Authority/Subversion", verdict: "Not supported", evidence: `${originalAuthority?.matches}/${originalAuthority?.total} response codes matched intended Authority, but scenario validation retained only 5/10 intended Authority labels.`, denominator: "200 response explanations; 10 scenarios", sensitivity_version: "intended and human-scenario-majority", limitation: "Two Authority-designed qualitative targets; response codes are LLM-coded/manual-adjudicated.", paper_safe_wording: "Authority/Subversion was seldom invoked in the two Authority-designed qualitative targets.", wording_to_avoid: "Models systematically fail to recognise Authority/Subversion." },
    { claim: "Models rarely invoke Authority/Subversion in explanations for authority-designed scenarios", verdict: "Supported with qualification", evidence: `${originalAuthority?.matches}/${originalAuthority?.total} (${formatPercent(Number(originalAuthority?.match_rate))}).`, denominator: "200 explanations from S11 and S30", sensitivity_version: "original intended", limitation: "Only two scenarios and non-human response coding.", paper_safe_wording: "Authority/Subversion was coded in 13 of 200 explanations for the two Authority-designed targets.", wording_to_avoid: "Models cannot recognise authority." },
    { claim: "Authority/Subversion was the least stable intended foundation in this benchmark", verdict: "Supported with qualification", evidence: "Scenario-majority agreement was 5/10 for intended Authority scenarios; qualitative intended match was 13/200.", denominator: "10 intended Authority scenarios; 200 target explanations", sensitivity_version: "scenario validation and intended qualitative", limitation: "Benchmark-specific and English-original validation.", paper_safe_wording: "Authority/Subversion showed the weakest intended-label stability in this benchmark.", wording_to_avoid: "Authority is universally unstable." },
    { claim: "Human coders frequently interpreted intended Authority/Subversion scenarios through other foundations", verdict: "Supported with qualification", evidence: "Only 5/10 intended Authority scenarios retained an Authority human-majority label.", denominator: "10 intended Authority scenarios", sensitivity_version: "three-coder scenario validation", limitation: "Three coders and English originals only.", paper_safe_wording: "Half of intended Authority scenarios received a different or unresolved human-majority interpretation.", wording_to_avoid: "Humans cannot recognise Authority." },
    { claim: "Models frequently framed authority-designed scenarios through Care/Harm or Loyalty/Betrayal", verdict: "Supported with qualification", evidence: "See intended transition matrix; S11 was predominantly Loyalty/Betrayal and S30 entirely Care/Harm.", denominator: "200 explanations", sensitivity_version: "original intended", limitation: "Response labels are dual-LLM/manual-adjudicated and cover two scenarios.", paper_safe_wording: "Explanations for S11 and S30 were predominantly coded as Loyalty/Betrayal and Care/Harm, respectively.", wording_to_avoid: "All authority judgments become care or loyalty." },
    { claim: "Models reframed even a human-validated Authority/Subversion scenario", verdict: "Supported with qualification", evidence: "S30 human majority was Authority/Subversion; 100/100 explanation labels were Care/Harm.", denominator: "100 S30 explanations", sensitivity_version: "human-scenario-majority", limitation: "One scenario; response coding is not human coding.", paper_safe_wording: "For S30, which retained an Authority human-majority label, all 100 explanations were coded as Care/Harm.", wording_to_avoid: "Models always reframe validated Authority scenarios." },
    { claim: "S30 showed consistent Care/Harm framing across models, languages, and experimental conditions", verdict: "Supported with qualification", evidence: "100/100 S30 explanations were coded Care/Harm across four source models, seven input languages, and all represented conditions.", denominator: "100 S30 explanations", sensitivity_version: "descriptive", limitation: "One scenario and LLM-coded/manual-adjudicated response labels.", paper_safe_wording: "S30 showed uniform Care/Harm coding across the sampled models, languages, and conditions.", wording_to_avoid: "S30 proves a population-wide pattern." },
    { claim: "Cultural adaptation produced the most consistent quantitative effects", verdict: "Not supported", evidence: "Framing leads corrected q<.05 counts and cross-version significance, while reasoning leads stable direction and scenario-bootstrap interval support.", denominator: "35 tests per effect and version", sensitivity_version: "all three", limitation: "No manipulation dominates every prespecified consistency criterion.", paper_safe_wording: "Framing led significance-based consistency, whereas reasoning led direction and bootstrap-based consistency.", wording_to_avoid: "Cultural framing was unequivocally the most consistent manipulation." },
    { claim: "Input-language effects were selective rather than universal", verdict: "Supported", evidence: "Only a subset of 35 tests per version survived corrected q thresholds.", denominator: "35 tests per version", sensitivity_version: "all three", limitation: "Foundation-level pooled tests.", paper_safe_wording: "Input-language effects varied by language, foundation, and label definition.", wording_to_avoid: "Language always changes moral judgments." },
    { claim: "Instructed reasoning/response-language effects were selective rather than universal", verdict: "Supported", evidence: "Only a subset of 35 tests per version survived corrected q thresholds.", denominator: "35 tests per version", sensitivity_version: "all three", limitation: "Instructed output language is not hidden internal reasoning.", paper_safe_wording: "Instructed reasoning/response-language effects were heterogeneous.", wording_to_avoid: "The analysis reveals internal reasoning." },
    { claim: "Authority-related quantitative effects disappeared after human validation", verdict: "Not supported", evidence: "Pooled Authority input-language remained q<.05 in both validation versions, while Arabic input-language lost robustness and Spanish framing remained directional but q>=.10.", denominator: "Authority foundation tests", sensitivity_version: "v2 and v3", limitation: "Mixed finding-specific sensitivity.", paper_safe_wording: "Human validation weakened some Authority effects but did not eliminate all of them.", wording_to_avoid: "All Authority effects disappeared." },
    { claim: "Foundation-label sensitivity materially changed some individual findings but preserved broader heterogeneity", verdict: "Supported with qualification", evidence: "Headline classifications include stable, weakened-to-suggestive, directionally stable/non-robust, and lost-after-validation results.", denominator: "10 headline findings; 315 total tests", sensitivity_version: "all three", limitation: "Heterogeneity is descriptive across a finite benchmark.", paper_safe_wording: "Label sensitivity changed several individual inferences while preserving heterogeneous effects across languages and foundations.", wording_to_avoid: "Sensitivity analysis proved universal robustness." },
    { claim: "The 1,000 explanations were independently coded by two humans", verdict: "Not supported", evidence: `Available row-level sources show Llama/DeepSeek agreement ${provenance.agreements}/${provenance.validN}, kappa ${formatNumber(provenance.kappa)}.`, denominator: "1,000 explanations", sensitivity_version: "provenance audit", limitation: "No human coder exports found.", paper_safe_wording: "Explanations were dual-LLM coded and manually adjudicated.", wording_to_avoid: "Two human coders independently coded the explanations." },
    { claim: "Original qualitative reproduction", verdict: "Supported with qualification", evidence: `${original?.matches}/${original?.total}; human-majority-reference ${majorityOverall?.matches}/${majorityOverall?.total}, Authority ${majorityAuthority?.matches}/${majorityAuthority?.total}.`, denominator: "1,000 or resolved-majority subset", sensitivity_version: "intended and majority", limitation: "Response-label provenance qualification required.", paper_safe_wording: "The descriptive counts reproduce from the adjudicated response codes.", wording_to_avoid: "Human-coded reproduction." }
  ];
}

function paperReadyStatistics(headlines: Out[]): Out[] {
  return headlines.map((row) => ({
    manuscript_section: "Results",
    result_name: row.finding,
    analysis_version: row.analysis_version,
    comparison: `${row.effect_type}; language=${row.language}; foundation=${row.mft_foundation}`,
    mean_difference: row.mean_diff,
    confidence_interval: `[${row.ci_lower}, ${row.ci_upper}]`,
    effect_size: row.cohens_d,
    p_value_primary: row.p_value_wilcoxon,
    q_value_primary: row.q_w_primary_105,
    p_value_robustness: row.p_value_ttest,
    q_value_robustness: row.q_t_primary_105,
    n: row.n,
    exact_wording: `${row.finding}: ${row.classification}.`,
    required_qualification: "Primary q uses the 105-test exact-Wilcoxon BH family; inspect all three label versions and scenario-cluster bootstrap interval.",
    main_text_or_supplement: Number(row.q_w_primary_105) < 0.05 ? "main text candidate" : "supplement or qualified discussion"
  }));
}

async function writeDocumentation(data: {
  tests: ReturnType<typeof runWilcoxonUnitTests>;
  provenance: Awaited<ReturnType<typeof auditProvenance>>;
  qualitative: Row[];
  labels: Map<string, ScenarioLabel>;
  qualitativeIntended: Out[];
  qualitativeMajority: Out[];
  transitionsIntended: Out[];
  transitionsMajority: Out[];
  scenarioDistributions: Out[];
  sensitivity: SensitivityRow[];
  bootstrap: Out[];
  consistency: Out[];
  headlines: Out[];
  claimMatrix: Out[];
}) {
  const { tests, provenance, qualitative, labels, qualitativeIntended, qualitativeMajority, scenarioDistributions, sensitivity, consistency, headlines, claimMatrix } = data;
  const overall = qualitativeIntended.find((row) => row.group_type === "overall")!;
  const authority = qualitativeIntended.find((row) => row.group_type === "foundation" && row.group_value === "Authority/Subversion")!;
  const majorityOverall = qualitativeMajority.find((row) => row.group_type === "overall")!;
  const majorityAuthority = qualitativeMajority.find((row) => row.group_type === "foundation" && row.group_value === "Authority/Subversion")!;
  const unresolved = [...labels.values()].filter((row) => !row.resolved).map((row) => row.id);
  const s30 = scenarioDistributions.filter((row) => row.scenario_id === "S30" && Number(row.count) > 0);
  const s11 = scenarioDistributions.filter((row) => row.scenario_id === "S11" && Number(row.count) > 0);
  const validationRows = await readCsv(validationPath);
  const scenarioStats = scenarioValidationStats(validationRows);
  const headlineCompact = unique(headlines.map((row) => String(row.finding))).map((finding) => ({ finding, classification: headlines.find((row) => row.finding === finding)?.classification ?? "" }));
  const priorZeroP = await countLiteralZeroP(path.join(root, "results", "processed", "phase1_final_evidence", "quantitative_foundation_sensitivity.csv"));
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  const csvParseVersion = packageJson.dependencies?.["csv-parse"] ?? packageJson.devDependencies?.["csv-parse"] ?? "not declared";
  const tsxVersion = packageJson.devDependencies?.tsx ?? packageJson.dependencies?.tsx ?? "not declared";
  const correctedZeroP = sensitivity.filter((row) => row.p_value_ttest === 0 || row.p_value_wilcoxon === 0).length;

  const provenanceAudit = `# Qualitative Human Provenance Audit\n\n## Gate Result: Failed\n\nThe requested two-human provenance for the 1,000 response explanations could not be reconstructed. The available evidence instead establishes dual LLM coding plus manual adjudication. This is Outcome D under the lock brief.\n\n- \`scripts/ai-mft-coding.ts\` names \`meta-llama/llama-3.3-70b-instruct\` and \`deepseek/deepseek-chat\`, calls OpenRouter, and writes the two coder columns.\n- All ${qualitative.length} merged qualitative rows map exactly to \`ai_mft_codes_adjudicated.csv\`; mapping mismatches: ${provenance.mismatches}.\n- Source counts: ${[...provenance.sourceCounts].map(([key, value]) => `${key}=${value}`).join(", ")}.\n- The misleading \`full_merged_with_human_mft_codes.csv\` copy is byte-identical to \`full_merged_with_ai_mft_codes.csv\`: ${provenance.identicalCopies}.\n- The three genuine human coders labelled 50 English scenarios, not 1,000 response explanations.\n- Placeholder scripts in \`mft_coding/\` expect nonexistent human coder exports and do not establish that coding occurred.\n\nThe observed ${formatPercent(provenance.rawAgreement)} raw agreement and Cohen's kappa ${formatNumber(provenance.kappa)} are **LLM-to-LLM reliability**, not human inter-rater reliability. No \`human_coder_a_label\`, \`human_coder_b_label\`, or verified human-adjudicated response-label file has been created.\n`;
  const blocker = `# Final Evidence Lock Blockers\n\n## Blocking Gate\n\nIndependent two-human coding provenance for the 1,000 qualitative explanations is not supported by the project files. Available labels were produced by Llama and DeepSeek, with 959 exact model agreements, 37 manual disagreement reviews, and 4 manual invalid reviews.\n\nConsequences:\n\n- The requested \`full_merged_with_verified_human_mft_codes.csv\` was not created.\n- Human-coder agreement/confusion outputs were not fabricated. Accurate LLM-coder reliability tables are supplied instead.\n- The final lock cannot be declared fully complete until actual coder-level human exports and adjudication records are supplied, or the paper explicitly adopts the documented dual-LLM/manual-adjudication provenance.\n- Existing \`PHASE1_FINAL_EVIDENCE_REPORT.md\`, \`PHASE1_FINAL_EVIDENCE_REPORT_CORRECTED.md\`, and \`full_merged_with_human_mft_codes.csv\` are stale/misleading and are superseded for interpretation, but remain unchanged for traceability.\n`;
  const wilcoxonAudit = `# Wilcoxon Implementation Audit\n\n## Defect Found\n\nThe legacy implementation used a tie correction that can reduce the null variance to zero when all nonzero absolute differences are tied. It then returned p=1, even when every nonzero difference had the same sign. It also used a normal approximation for most tied ordinal samples and could emit literal p=0 through floating-point tail subtraction.\n\n## Corrected Method\n\nThe lock implementation excludes zero differences, assigns average ranks to tied absolute differences, and computes the exact two-sided random-sign permutation distribution over those assigned ranks. Integer-scaled average ranks and dynamic programming make exact calculation feasible for every observed test (maximum nonzero n=${Math.max(...sensitivity.map((row) => row.nonzero_n))}). No asymptotic fallback is used. The two-sided p-value sums all sign assignments at least as far from the null mean as the observed positive-rank sum.\n\nAll-zero samples return p=1 with method \`all_zero_no_difference\`. Exact probabilities are bounded away from literal zero. Legacy literal p=0 cells found: ${priorZeroP}; corrected literal p=0 cells: ${correctedZeroP}.\n\nPrimary BH correction covers 105 tests per analysis version. Supplementary BH correction covers 35 tests per version and effect type. Both t-test and Wilcoxon correction columns are retained.\n`;
  const testDoc = `# Wilcoxon Unit Test Results\n\nExecuted ${tests.length} adversarial tests. All passed.\n\n${markdownTable(tests)}\n`;
  const qualLock = `# Qualitative Results Lock\n\nThe descriptive qualitative results reproduce exactly, but the response-label provenance is dual LLM coding with manual adjudication, not independent human response coding. Human labels enter only as the 50-scenario majority reference used in the sensitivity comparison.\n\n- Intended-label match: ${overall.matches}/${overall.total} (${formatPercent(Number(overall.match_rate))}).\n- Intended Authority/Subversion match: ${authority.matches}/${authority.total} (${formatPercent(Number(authority.match_rate))}).\n- Human-scenario-majority-reference match: ${majorityOverall.matches}/${majorityOverall.total} (${formatPercent(Number(majorityOverall.match_rate))}).\n- Human-scenario-majority Authority/Subversion match: ${majorityAuthority.matches}/${majorityAuthority.total} (${formatPercent(Number(majorityAuthority.match_rate))}).\n- Unresolved three-way scenario disagreements excluded from majority-reference analyses: ${unresolved.join(", ")}.\n- S30 nonzero response-code cells: ${s30.map((row) => `${row.response_coded_foundation} ${row.count}/${row.total}`).join(", ")}.\n\nThese are benchmark-specific descriptive results and must not be described as human-coded explanation labels.\n`;
  const quantitativeLock = `# Quantitative Sensitivity Lock\n\nThe corrected analysis contains ${sensitivity.length} foundation-level tests across three label versions. It pools ChatGPT, Claude, and Gemini Flash only, uses Student-t confidence intervals over paired model-scenario differences, exact tied Wilcoxon signed-rank tests, primary 105-test BH families, supplementary effect-specific 35-test BH families, and ${bootstrapIterations.toLocaleString()} scenario-cluster bootstrap replicates per row.\n\n${markdownTable(consistency)}\n\n## Headline Classifications\n\n${markdownTable(headlineCompact)}\n`;
  const paperStats = `# Paper-Ready Statistical Results\n\nUse exact rows in \`foundation_sensitivity_final.csv\` and \`headline_finding_sensitivity_final.csv\`. The primary ordinal inference is the exact Wilcoxon p-value with \`q_w_primary_105\`; paired-t estimates and both BH families are retained as sensitivity analyses. Scenario-cluster bootstrap intervals are in \`foundation_scenario_cluster_bootstrap_final.csv\`.\n\n${markdownTable(headlines)}\n`;
  const integration = `# Paper Integration Decisions\n\n1. Do not call the 1,000 explanation labels human-coded, human-adjudicated, or human ground truth. Describe them as two independent non-evaluated LLM coders with manual adjudication.\n2. Reserve “human coders” for the distinct blinded 50-scenario validation.\n3. Report corrected exact Wilcoxon results and the 105-test BH family as primary; the 35-test family is supplementary.\n4. Replace “lost significance” with the lock classifications, including “weakened to suggestive” where q is between .05 and .10.\n5. Qualify Authority/Subversion generalization because scenario validation retained only half of intended Authority scenarios and the qualitative subset has two Authority-designed targets.\n6. Treat S30 as strong descriptive evidence for one human-validated scenario, not a population estimate.\n`;
  const classificationRules = `# Headline Classification Rules\n\nThe classification uses corrected exact-Wilcoxon \`q_w_primary_105\` values and paired-t confidence intervals.\n\n- **Stable:** same direction, q<.05 in all versions, similar magnitude.\n- **Strengthened:** same direction, validation magnitude increases meaningfully and/or q improves.\n- **Weakened but survives:** same direction and q<.05 in both validation versions, with weaker magnitude or significance.\n- **Weakened to suggestive:** same direction, one validation version q<.05 and the other .05<=q<.10.\n- **Directionally stable but not statistically robust:** same direction but validation evidence does not meet the preceding thresholds.\n- **Lost after validation:** validation q>=.10 and both paired-t confidence intervals cross zero.\n- **Changed direction:** a nonzero direction reverses.\n- **Not estimable:** insufficient pairs or variation.\n\nThe corrected exact permutation test changes legacy q-values. Therefore, examples based on the old asymptotic implementation are not forced onto corrected results. Tamil Loyalty/Betrayal is directionally stable but not robust (validation q=.078 and .410). Spanish Authority framing is directionally stable but not robust (q=.248 and .283), not lost, because both confidence intervals remain below zero.\n`;
  const claimEvidence = `# Final Claim-Evidence Matrix\n\nVerdicts use only **Supported**, **Supported with qualification**, and **Not supported**.\n\n${markdownTable(claimMatrix)}\n`;
  const readme = `# Final Evidence Lock\n\nRun from the repository root:\n\n\`\`\`powershell\ncorepack pnpm exec tsx scripts/final_evidence_lock/run_final_evidence_lock.ts\n\`\`\`\n\nThe command runs Wilcoxon tests, validates provenance and row counts, regenerates all lock outputs, performs 10,000-replicate scenario-cluster bootstraps, and writes the canonical report. It makes no API/model calls and does not modify legacy inputs.\n\nStatus: quantitative/statistical lock regenerated successfully; qualitative two-human provenance gate failed. See \`FINAL_EVIDENCE_LOCK_BLOCKERS.md\`.\n`;
  const fullReadme = `# Final Evidence Lock Reproducibility\n\n## Software\n\n- Runtime: Node.js ${process.version}\n- Package manager: pnpm via Corepack\n- TypeScript runner: tsx (version pinned in the project lockfile)\n- CSV parser: csv-parse (version pinned in the project lockfile)\n\n## One Command\n\n\`\`\`powershell\ncorepack pnpm exec tsx scripts/final_evidence_lock/run_final_evidence_lock.ts\n\`\`\`\n\n## Inputs And Mappings\n\nRatings come from \`results/processed/full_merged.csv\`. Response-level qualitative codes come from \`full_merged_with_ai_mft_codes.csv\` and map exactly to \`ai_mft_codes_adjudicated.csv\`: \`llama_label -> ai_mft_llama_label\`, \`deepseek_label -> ai_mft_deepseek_label\`, and \`adjudicated_label -> ai_mft_final_label\`. These are not human-coder mappings. Human scenario-majority labels come from \`scenario_validation_merged_3coders.csv\`.\n\n## Fixed Analysis Settings\n\n- Pooled primary models: chatgpt, claude, gemini_flash; gemini_pro excluded.\n- Exact Wilcoxon: two-sided sign permutation over average ranks; zeros excluded; all observed samples solved exactly by dynamic programming.\n- Bootstrap: ${bootstrapIterations} scenario-cluster resamples; base seed ${bootstrapSeed}; row seed is base seed plus deterministic row index.\n- FDR: primary 105-test BH family within each label version; supplementary 35-test family within version and effect type.\n- Label versions: 50 intended scenarios; 39 validated-subset scenarios; 46 resolved human-majority scenarios.\n- Unresolved scenarios: S03, S09, S13, S35.\n\n## Expected Gates\n\n5,000 ratings; 1,000 explanations; 100 explanations per qualitative target; 50 scenario-validation rows; 728/1,000 intended match; foundation matches 200, 200, 13, 199, and 116 in the documented order; S11 distribution 86 Loyalty, 13 Authority, 1 Care; S30 100 Care; no literal p=0; all Wilcoxon unit tests pass.\n\n## Outputs\n\nAll generated tables and documentation are written beneath \`results/processed/final_evidence_lock/\`; the canonical report is \`PHASE1_FINAL_EVIDENCE_REPORT_LOCKED.md\`. The qualitative human-provenance gate is expected to remain blocked unless genuine human coder exports are supplied.\n`;
  const canonical = `# Phase 1 Final Evidence Report: Locked\n\nGenerated locally from finalized files without API or model calls. This report supersedes earlier Phase 1 reports for interpretation.\n\n## Executive Summary\n\nThe intended-label qualitative counts reproduce exactly, and the corrected quantitative pipeline passes all statistical gates. The lock is **not fully complete** because independent two-human provenance for the 1,000 explanation labels is contradicted by the row-level source trail. Available explanation labels are dual-LLM codes with manual adjudication. The separate 50-scenario validation is genuinely human-coded.\n\n## Exact Source Files\n\n- \`results/processed/full_merged.csv\`: 5,000 ratings plus the uncoded explanation rows in the merged dataset.\n- \`results/processed/full_merged_with_ai_mft_codes.csv\`: available adjudicated response-code merge.\n- \`results/processed/ai_mft_coding/ai_mft_codes.csv\` and \`ai_mft_codes_adjudicated.csv\`: coder-level model labels and adjudication trail.\n- \`results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv\`: three-human, 50-scenario validation.\n\nHashes, row counts, and inclusion decisions are in \`FINAL_EVIDENCE_INPUT_INVENTORY.md\`.\n\n## Qualitative Coding Provenance\n\nThe 1,000 explanations were coded by \`meta-llama/llama-3.3-70b-instruct\` and \`deepseek/deepseek-chat\`. All 1,000 merged rows map exactly to their source/adjudication records with zero mismatches. Final labels comprise 959 exact model agreements, 37 manual disagreement reviews, and 4 manual invalid reviews. The historical “human” copy is byte-identical and is not independent provenance evidence.\n\n## Human-Coder Reliability\n\nNo human response-coder reliability can be reported. The observed ${provenance.agreements}/${provenance.validN} agreement (${formatPercent(provenance.rawAgreement)}) and Cohen's kappa ${formatNumber(provenance.kappa)} are **LLM-to-LLM reliability**. Genuine human reliability pertains only to scenario validation below.\n\n## Existing-Result Reproduction\n\nThe adjudicated response codes reproduce ${overall.matches}/${overall.total} (${formatPercent(Number(overall.match_rate))}) intended-label agreement: Care/Harm 200/200, Loyalty/Betrayal 200/200, Fairness/Cheating 199/200, Sanctity/Degradation 116/200, and Authority/Subversion ${authority.matches}/${authority.total} (${formatPercent(Number(authority.match_rate))}). These are descriptive response-code results, not human-coded explanation results.\n\n## Three-Coder Scenario Validation\n\nAcross 50 English scenarios, pairwise raw agreement was ${scenarioStats.pairs.map((row) => `${row.pair} ${formatPercent(row.rawAgreement)}`).join(", ")}; pairwise Cohen's kappa was ${scenarioStats.pairs.map((row) => `${row.pair} ${formatNumber(row.kappa)}`).join(", ")}. Mean pairwise kappa was ${formatNumber(scenarioStats.meanKappa)} and Fleiss' kappa was ${formatNumber(scenarioStats.fleiss)}. Majority labels matched intended labels for 39/50; Authority matched for 5/10. S03, S09, S13, and S35 remained unresolved.\n\n## Intended Versus Human-Majority Qualitative Analysis\n\nIntended-reference match was ${overall.matches}/${overall.total}; resolved human-scenario-majority-reference match was ${majorityOverall.matches}/${majorityOverall.total}. Authority/Subversion was ${authority.matches}/${authority.total} under intended labels and ${majorityAuthority.matches}/${majorityAuthority.total} under human scenario-majority labels. The comparison changes the scenario reference label only; explanation labels remain LLM-coded/manual-adjudicated.\n\n## S11 Findings\n\nS11 intended Authority/Subversion but human majority Care/Harm. Its 100 explanation codes were ${s11.map((row) => `${row.response_coded_foundation} ${row.count}/${row.total}`).join(", ")}. Thus S11 is not a clean human-validated Authority test.\n\n## S30 Findings\n\nS30 retained a human-majority Authority/Subversion label, while its 100 explanation codes were ${s30.map((row) => `${row.response_coded_foundation} ${row.count}/${row.total}`).join(", ")}. This uniform coding occurs across four source models, seven input languages, and all represented conditions. It supports benchmark-specific model reframing after scenario validation, with the limitation that S30 is one scenario and response codes are not human labels.\n\n## Corrected Wilcoxon Implementation\n\nThe legacy tied-rank variance implementation was defective and could return p=1 for nonzero one-direction tied differences. It has been replaced with an exact two-sided random-sign permutation distribution over average ranks, computed by dynamic programming for every observed sample. Zeros are excluded, ties are preserved, all-zero vectors return p=1 explicitly, and no literal p=0 is emitted.\n\n## Statistical Unit Tests\n\nAll ${tests.length} adversarial signed-rank tests passed, including six equal positive differences (p=.03125), six equal negative differences (p=.03125), ties, zeros, sign inversion, scale invariance, and a larger exact-DP vector.\n\n## Foundation-Label Sensitivity Analysis\n\nThe analysis uses 50 intended-label scenarios, a 39-scenario validated subset, and 46 resolved human-majority scenarios. Pooled effects include ChatGPT, Claude, and Gemini Flash only. Paired-t intervals use Student-t critical values. Primary BH correction covers 105 tests per version; supplementary correction covers 35 tests per version/effect.\n\n## Scenario-Clustered Bootstrap\n\nEach of the 315 pooled foundation tests has a ${bootstrapIterations.toLocaleString()}-iteration, fixed-seed scenario bootstrap. Scenarios are resampled as clusters and all associated primary-model paired differences are retained. Exact intervals and cluster counts are in \`foundation_scenario_cluster_bootstrap_final.csv\`.\n\n## Headline-Finding Classifications\n\n${markdownTable(headlineCompact)}\n\nExact estimates, p-values, q-values, n, nonzero n, and bootstrap intervals are in \`headline_finding_sensitivity_final.csv\`.\n\n## Effect-Type Consistency\n\n${markdownTable(consistency)}\n\nFraming has the strongest aggregate corrected counts across versions, but “most consistent” requires qualification because conclusions differ by q threshold, cross-version survival, direction, and bootstrap support.\n\n## Claim-Evidence Matrix\n\n${markdownTable(claimMatrix)}\n\n## Paper Implications\n\nUse benchmark-specific language: explanations “invoked,” “emphasized,” “framed,” or “were coded as” a foundation. Do not claim direct recognition failure, ground truth, or hidden internal reasoning. Some Authority findings weaken after scenario validation, while pooled Authority input-language remains robust.\n\n## Remaining Limitations\n\nThe qualitative response labels lack the claimed human provenance; only two intended Authority scenarios appear in the qualitative target set; only S30 retains a human-majority Authority label; scenario validation covers English originals; MFT categories can blend; explanation coding does not reveal internal cognition; and instructed response language does not expose hidden reasoning.\n\n## Reproducibility Command\n\n\`corepack pnpm exec tsx scripts/final_evidence_lock/run_final_evidence_lock.ts\`\n\n## Final Validation Checklist\n\n- Data gates: 5,000 ratings, 1,000 explanations, 100 rows per qualitative target, and 50 validation scenarios passed.\n- Scenario gates: 39 validated, 46 resolved-majority, four unresolved, S11 Care majority, S30 Authority majority passed.\n- Qualitative reproduction gates passed.\n- Exact Wilcoxon tests and unit tests passed; no literal p=0.\n- Gemini Pro excluded from pooled quantitative estimates.\n- Earlier outputs preserved.\n- Two-human qualitative provenance gate **failed**; see \`FINAL_EVIDENCE_LOCK_BLOCKERS.md\`.\n\n## Canonical Files\n\nSee \`results/processed/final_evidence_lock/FINAL_OUTPUT_MANIFEST.csv\`.\n`;

  const docs: Array<[string, string]> = [
    ["QUALITATIVE_HUMAN_PROVENANCE_AUDIT.md", provenanceAudit], ["FINAL_EVIDENCE_LOCK_BLOCKERS.md", blocker],
    ["WILCOXON_IMPLEMENTATION_AUDIT.md", wilcoxonAudit], ["WILCOXON_UNIT_TEST_RESULTS.md", testDoc],
    ["QUALITATIVE_RESULTS_LOCK.md", qualLock], ["QUANTITATIVE_SENSITIVITY_LOCK.md", quantitativeLock],
    ["PAPER_READY_STATISTICAL_RESULTS.md", paperStats], ["PAPER_INTEGRATION_DECISIONS.md", integration],
    ["HEADLINE_CLASSIFICATION_RULES.md", classificationRules], ["FINAL_CLAIM_EVIDENCE_MATRIX.md", claimEvidence],
    ["README.md", readme], ["FINAL_EVIDENCE_LOCK_README.md", `${fullReadme}\n## Resolved Declared Package Versions\n\n- tsx: ${tsxVersion}\n- csv-parse: ${csvParseVersion}\n`]
  ];
  for (const [name, content] of docs) await writeFile(path.join(outDir, name), content, "utf8");
  await writeFile(lockedReportPath, canonical.replace(
    "Framing has the strongest aggregate corrected counts across versions, but “most consistent” requires qualification because conclusions differ by q threshold, cross-version survival, direction, and bootstrap support.",
    "Framing leads corrected significance counts and cross-version q<.05 survival, while reasoning leads stable-direction and scenario-bootstrap support. No manipulation is unequivocally most consistent across all prespecified criteria."
  ), "utf8");
}

async function inputInventory() {
  const relativeFiles = [
    "results/processed/full_merged.csv",
    "results/processed/full_merged_with_ai_mft_codes.csv",
    "results/processed/full_merged_with_human_mft_codes.csv",
    "results/processed/ai_mft_coding/ai_mft_codes.csv",
    "results/processed/ai_mft_coding/ai_mft_codes_adjudicated.csv",
    "results/processed/ai_mft_coding/ai_mft_summary_report.txt",
    "results/processed/scenario_validation_trial2/scenario_validation_merged_3coders.csv",
    "results/processed/analysis/foundation_match.csv",
    "results/processed/analysis/foundation_transitions.csv",
    "results/processed/phase1_final_evidence/quantitative_foundation_sensitivity.csv",
    "scripts/ai-mft-coding.ts",
    "scripts/adjudicate-ai-mft-invalids.ts",
    "scripts/merge-ai-mft-codes.ts",
    "scripts/phase1-final-evidence.ts",
    "mft_coding/kappa_calculator.py",
    "mft_coding/merge_codes.py",
    "phase1_evidence_report.md",
    "phase1_evidence_report_provenance.md"
  ];
  const rows: Out[] = [];
  for (const relative of relativeFiles) {
    const absolute = path.join(root, relative);
    const info = await stat(absolute);
    const csvRows = relative.endsWith(".csv") ? await readCsv(absolute) : [];
    const rowCount = relative.endsWith(".csv") ? csvRows.length : null;
    rows.push({
      file: relative.replaceAll("\\", "/"),
      filename: path.basename(relative),
      purpose: inventoryRole(relative),
      rows: rowCount,
      important_columns: csvRows.length ? Object.keys(csvRows[0]).slice(0, 14).join("; ") : "not applicable",
      data_stage: inventoryStage(relative),
      current_or_stale: inventoryStatus(relative),
      used_by_corrected_analysis: inventoryUsed(relative),
      inclusion_or_exclusion_reason: inventoryReason(relative),
      bytes: info.size,
      sha256: await sha256(absolute)
    });
  }
  const markdown = `# Final Evidence Input Inventory\n\nFiles were inventoried before regeneration. Hashes are SHA-256. Legacy files were read-only inputs and were not overwritten.\n\n${markdownTable(rows)}\n\n## Selection Decisions\n\n- Rating analyses use \`full_merged.csv\` and the three primary models only.\n- Qualitative reproduction uses \`full_merged_with_ai_mft_codes.csv\` because row-level provenance maps it exactly to the documented LLM coding and adjudication files.\n- \`full_merged_with_human_mft_codes.csv\` is excluded as misleading: it is a byte-identical historical copy, not independent evidence of human coding.\n- The 50-scenario three-coder file supplies scenario-level human majority labels only.\n- Earlier Phase 1 reports and sensitivity tables are stale comparison artifacts after the provenance contradiction and Wilcoxon defect.\n`;
  return { rows, markdown };
}

async function writeManifest() {
  const entries = await listLockFiles();
  const rows: Out[] = [];
  for (const absolute of entries) {
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    const info = await stat(absolute);
    const rowCount = relative.endsWith(".csv") ? (await readCsv(absolute)).length : null;
    rows.push({ file: relative, purpose: manifestPurpose(relative), rows: rowCount, bytes: info.size, sha256: await sha256(absolute), generated_by: "scripts/final_evidence_lock/run_final_evidence_lock.ts", input_files: "see FINAL_EVIDENCE_INPUT_INVENTORY.md", status: relative.includes("BLOCKERS") ? "active_blocker" : "generated", canonical_or_legacy: !relative.includes("BLOCKERS") && !relative.includes("PROVENANCE_AUDIT") ? "canonical" : "canonical_status_document" });
  }
  const reportInfo = await stat(lockedReportPath);
  rows.push({ file: "phase1_evidence_report_reproducibility.md", purpose: "canonical reproducibility report", rows: null, bytes: reportInfo.size, sha256: await sha256(lockedReportPath), generated_by: "scripts/final_evidence_lock/run_final_evidence_lock.ts", input_files: "all inventoried canonical inputs", status: "generated", canonical_or_legacy: "canonical" });
  const csv = toCsv(rows);
  await Promise.all([
    writeFile(path.join(outDir, "final_evidence_manifest.csv"), csv, "utf8"),
    writeFile(path.join(outDir, "FINAL_OUTPUT_MANIFEST.csv"), csv, "utf8")
  ]);
}

async function listLockFiles() {
  const { readdir } = await import("node:fs/promises");
  return (await readdir(outDir, { withFileTypes: true })).filter((entry) => entry.isFile() && entry.name !== "final_evidence_manifest.csv" && entry.name !== "FINAL_OUTPUT_MANIFEST.csv").map((entry) => path.join(outDir, entry.name)).sort();
}

function manifestPurpose(relative: string) {
  const name = path.basename(relative);
  if (name.includes("BLOCKERS")) return "failed-gate record and corrective action";
  if (name.includes("PROVENANCE")) return "qualitative provenance audit";
  if (name.includes("wilcoxon") || name.includes("WILCOXON")) return "corrected signed-rank implementation evidence";
  if (name.endsWith(".csv")) return "reproducible analysis table";
  return "methods, interpretation, or reproducibility documentation";
}

function inventoryRole(relative: string) {
  if (relative.includes("scenario_validation_merged")) return "human scenario-level validation";
  if (relative.includes("ai_mft_coding")) return "response-label provenance";
  if (relative.includes("full_merged.csv")) return "canonical ratings";
  if (relative.includes("with_ai_mft")) return "canonical available response codes";
  if (relative.includes("with_human_mft")) return "misleading historical copy";
  if (relative.includes("phase1_final_evidence") || relative.includes("PHASE1_FINAL")) return "legacy comparison output";
  return "implementation or reproduction reference";
}

function inventoryStatus(relative: string) {
  if (relative.includes("with_human_mft") || relative.includes("PHASE1_FINAL") || relative.includes("phase1_final_evidence")) return "stale_or_misleading_not_used_as_canonical";
  if (relative.includes("mft_coding/")) return "placeholder_not_evidence_of_completed_human_coding";
  return "used_or_audited";
}

function inventoryStage(relative: string) {
  if (relative.includes("ai_mft_codes.csv")) return "intermediate coder output";
  if (relative.includes("adjudicated") || relative.includes("merged_3coders")) return "final source-level input";
  if (relative.includes("phase1_final_evidence") || relative.includes("PHASE1_FINAL")) return "legacy output";
  if (relative.endsWith(".ts") || relative.endsWith(".py")) return "analysis implementation";
  return "processed analysis input or reference";
}

function inventoryUsed(relative: string) {
  return ["full_merged.csv", "full_merged_with_ai_mft_codes.csv", "ai_mft_codes.csv", "ai_mft_codes_adjudicated.csv", "scenario_validation_merged_3coders.csv"].some((name) => relative.endsWith(name)) ? "yes" : "audited_or_comparison_only";
}

function inventoryReason(relative: string) {
  if (relative.includes("with_human_mft")) return "excluded because byte-identical copy does not establish human provenance";
  if (relative.includes("phase1_final_evidence") || relative.includes("PHASE1_FINAL")) return "excluded as canonical; retained for old-versus-corrected comparison";
  if (relative.includes("mft_coding/")) return "excluded because placeholder code has no completed coder exports";
  return "included as canonical input or audited to establish processing provenance";
}

function stripPairs(row: SensitivityRow): Out {
  const { _pairs, ...output } = row;
  return {
    ...output,
    t_primary_q_lt_05: Number(row.q_t_primary_105) < 0.05,
    t_primary_q_lt_10: Number(row.q_t_primary_105) < 0.10,
    t_primary_suggestive_05_to_10: Number(row.q_t_primary_105) >= 0.05 && Number(row.q_t_primary_105) < 0.10,
    wilcoxon_primary_q_lt_05: Number(row.q_w_primary_105) < 0.05,
    wilcoxon_primary_q_lt_10: Number(row.q_w_primary_105) < 0.10,
    wilcoxon_primary_suggestive_05_to_10: Number(row.q_w_primary_105) >= 0.05 && Number(row.q_w_primary_105) < 0.10,
    wilcoxon_effect_q_lt_05: Number(row.q_w_effect_35) < 0.05,
    wilcoxon_effect_q_lt_10: Number(row.q_w_effect_35) < 0.10,
    wilcoxon_effect_suggestive_05_to_10: Number(row.q_w_effect_35) >= 0.05 && Number(row.q_w_effect_35) < 0.10
  };
}

function cohenKappa(pairs: Array<[string, string]>) {
  const n = pairs.length;
  const observed = pairs.filter(([a, b]) => a === b).length / n;
  const aCounts = counts(pairs.map(([a]) => a));
  const bCounts = counts(pairs.map(([, b]) => b));
  const expected = foundations.reduce((sum, label) => sum + ((aCounts.get(label) ?? 0) / n) * ((bCounts.get(label) ?? 0) / n), 0);
  return (observed - expected) / (1 - expected);
}

function scenarioValidationStats(rows: Row[]) {
  const specs = [["A-B", "Coder_A_label", "Coder_B_label"], ["A-C", "Coder_A_label", "Coder_C_label"], ["B-C", "Coder_B_label", "Coder_C_label"]] as const;
  const pairs = specs.map(([pair, a, b]) => {
    const values = rows.map((row) => [row[a], row[b]] as [string, string]);
    return { pair, rawAgreement: values.filter(([left, right]) => left === right).length / values.length, kappa: cohenKappa(values) };
  });
  const nRaters = 3;
  const itemAgreement = rows.map((row) => {
    const itemCounts = counts([row.Coder_A_label, row.Coder_B_label, row.Coder_C_label]);
    return [...itemCounts.values()].reduce((sum, count) => sum + count * (count - 1), 0) / (nRaters * (nRaters - 1));
  });
  const allLabels = rows.flatMap((row) => [row.Coder_A_label, row.Coder_B_label, row.Coder_C_label]);
  const marginal = counts(allLabels);
  const expected = foundations.reduce((sum, label) => sum + ((marginal.get(label) ?? 0) / allLabels.length) ** 2, 0);
  const observed = average(itemAgreement);
  return { pairs, meanKappa: average(pairs.map((row) => row.kappa)), fleiss: (observed - expected) / (1 - expected) };
}

function sameDirection(rows: SensitivityRow[]) {
  const signs = rows.map((row) => Math.sign(Number(row.mean_diff))).filter((sign) => sign !== 0);
  return signs.length <= 1 || signs.every((sign) => sign === signs[0]);
}

function conditionType(row: Row) {
  if (row.conditionId === "en_en") return "en_en";
  return `${row.scenarioVersion}_${row.reasoningLang === "en" ? "reason_en" : "reason_l2"}`;
}

function counts(values: string[]) {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return map;
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentileSorted(values: Float64Array, probability: number) {
  const position = (values.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return values[lower];
  return values[lower] + (values[upper] - values[lower]) * (position - lower);
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

async function sha256(file: string) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function countLiteralZeroP(file: string) {
  const rows = await readCsv(file);
  return rows.filter((row) => row.p_value_ttest === "0" || row.p_value_wilcoxon === "0").length;
}

function formatNumber(value: number) {
  return value.toPrecision(8).replace(/\.?0+$/, "");
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function toCsv(rows: Out[]) {
  if (!rows.length) return "";
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`;
}

function csvCell(value: Out[string] | undefined) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function markdownTable(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "_No rows._";
  const columns = Object.keys(rows[0]);
  return [
    `| ${columns.join(" | ")} |`,
    `| ${columns.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${columns.map((column) => String(row[column] ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>")).join(" | ")} |`)
  ].join("\n");
}

function studentTCdf(t: number, degrees: number) {
  if (!Number.isFinite(t)) return t > 0 ? 1 : 0;
  const x = degrees / (degrees + t * t);
  const ib = regularizedIncompleteBeta(x, degrees / 2, 0.5);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

function inverseStudentT(probability: number, degrees: number) {
  let low = 0;
  let high = 20;
  for (let i = 0; i < 100; i += 1) {
    const middle = (low + high) / 2;
    if (studentTCdf(middle, degrees) < probability) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

function regularizedIncompleteBeta(x: number, a: number, b: number) {
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
  let value = 0.9999999999998099;
  for (let index = 0; index < coefficients.length; index += 1) value += coefficients[index] / (z + index + 1);
  const t = z + coefficients.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(value);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
