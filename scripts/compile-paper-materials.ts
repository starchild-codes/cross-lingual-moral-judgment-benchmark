import { parse } from "csv-parse/sync";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateConditions } from "../lib/conditions";
import { modelConfig } from "../lib/config";
import { languageCodes, languages } from "../lib/languages";
import { mftCodes } from "../lib/mft-labels";
import { allSystemPrompts, buildUserPrompt } from "../lib/prompts";
import { loadScenarioMetadata } from "../lib/scenarios";

type Row = Record<string, string>;
type MarkdownTableRow = Record<string, string | number | boolean | null | undefined>;

const root = process.cwd();
const materialsDir = path.join(root, "paper_materials");
const processedDir = path.join(root, "results", "processed");
const analysisDir = path.join(processedDir, "analysis");
const figureDir = path.join(root, "results", "figures");
const finalDataFile = path.join(processedDir, "full_merged_with_ai_mft_codes.csv");
const preCodedDataFile = path.join(processedDir, "full_merged.csv");
const aiCodingFile = path.join(processedDir, "ai_mft_coding", "ai_mft_codes.csv");
const analysisFiles = [
  ["language_effect", path.join(analysisDir, "language_effects.csv")],
  ["framing_effect", path.join(analysisDir, "framing_effects.csv")],
  ["reasoning_effect", path.join(analysisDir, "reasoning_effects.csv")],
  ["foundation_breakdown", path.join(analysisDir, "foundation_breakdown.csv")],
  ["model_comparison", path.join(analysisDir, "model_comparison.csv")],
  ["reference_divergence", path.join(analysisDir, "reference_divergence.csv")],
  ["foundation_match", path.join(analysisDir, "foundation_match.csv")],
  ["foundation_transitions", path.join(analysisDir, "foundation_transitions.csv")]
] as const;

async function main() {
  await rm(materialsDir, { recursive: true, force: true });
  await mkdir(materialsDir, { recursive: true });

  const [finalRows, preCodedRows, codingRows, scenarios, languageReview] = await Promise.all([
    readCsv(finalDataFile),
    readCsv(preCodedDataFile),
    readCsv(aiCodingFile),
    loadScenarioMetadata(),
    readJson(path.join(processedDir, "language-compliance-review.json"))
  ]);
  const analysis = Object.fromEntries(await Promise.all(analysisFiles.map(async ([name, file]) => [name, await readCsv(file)])));

  const kappa = reliabilityWithBootstrap(codingRows);
  const files = await Promise.all([
    write("00_facts_sheet.md", factsSheet(finalRows, codingRows, scenarios, kappa)),
    write("01_all_results.md", allResults(analysis)),
    write("02_headline_findings.md", headlineFindings(analysis)),
    write("03_figures_inventory.md", await figuresInventory()),
    write("04_example_responses.md", exampleResponses(finalRows, preCodedRows)),
    write("05_methods_raw_materials.md", methodsRawMaterials(scenarios)),
    write("06_limitations.md", limitations(finalRows, languageReview))
  ]);

  console.log(`Wrote ${files.length} paper-material files to ${materialsDir}`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
}

async function readJson(file: string) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function write(name: string, body: string) {
  const file = path.join(materialsDir, name);
  await writeFile(file, body, "utf8");
  return file;
}

function factsSheet(rows: Row[], codingRows: Row[], scenarios: Awaited<ReturnType<typeof loadScenarioMetadata>>, kappa: ReturnType<typeof reliabilityWithBootstrap>) {
  const scenarioIds = unique(rows.map((row) => row.scenarioId));
  const conditionIds = unique(rows.map((row) => row.conditionId));
  const modelRows = unique(rows.map((row) => row.modelKey)).map((modelKey) => {
    const row = rows.find((entry) => entry.modelKey === modelKey);
    return { model_key: modelKey, openrouter_model_string: row?.modelString ?? modelConfig[modelKey as keyof typeof modelConfig] ?? "" };
  });
  const apiCalls = group(rows, ["modelKey", "taskType"]).map((entry) => ({
    model_key: entry.modelKey,
    task_type: entry.taskType,
    rows: entry.rows.length,
    summed_attempt_count_api_calls: sum(entry.rows.map((row) => Number(row.attemptCount || 0)))
  }));
  const cost = sum(rows.map((row) => Number(row.cost || 0)));
  const created = rows.map((row) => row.createdAt).filter(Boolean).sort();
  const updated = rows.map((row) => row.updatedAt).filter(Boolean).sort();
  const nonNullErrors = rows.filter((row) => row.errorNote && row.errorNote.trim());
  const byModel = group(rows, ["modelKey"]).map((entry) => ({ model_key: entry.modelKey, rows: entry.rows.length }));
  const byScenario = group(rows, ["scenarioId"]).map((entry) => ({ scenario_id: entry.scenarioId, rows: entry.rows.length }));
  const byModelScenario = group(rows, ["modelKey", "scenarioId"]).map((entry) => ({ model_key: entry.modelKey, scenario_id: entry.scenarioId, rows: entry.rows.length }));
  const codingSources = group(rows.filter((row) => row.taskType === "qualitative"), ["ai_mft_code_source"]).map((entry) => ({
    ai_mft_code_source: entry.ai_mft_code_source || "(blank)",
    rows: entry.rows.length
  }));

  return `# Project Facts Sheet

Generated from on-disk data files on ${new Date().toISOString()}.

## Design Counts

- Final scenario count: ${scenarioIds.length}
- Languages in final data: ${languageCodes.map((code) => `${code} (${languages[code].name})`).join(", ")}
- Condition count: ${conditionIds.length}
- Final merged dataset rows: ${rows.length}
- Rating rows: ${rows.filter((row) => row.taskType === "rating").length}
- Qualitative rows: ${rows.filter((row) => row.taskType === "qualitative").length}

## Models

${markdownTable(modelRows)}

## API Calls And Cost

The table reports both row counts and summed \`attemptCount\`, because retries make attempted API calls differ from completed work-unit rows.

${markdownTable(apiCalls)}

- Total completed work-unit rows: ${rows.length}
- Total summed attemptCount API calls: ${sum(rows.map((row) => Number(row.attemptCount || 0)))}
- Total actual API cost from \`cost\` column: ${cost}

## Data Collection Date Range

- Earliest \`createdAt\`: ${created[0] ?? "NA"}
- Latest \`updatedAt\`: ${updated.at(-1) ?? "NA"}

## Final Dataset Breakdown

### Rows By Model

${markdownTable(byModel)}

### Rows By Scenario

${markdownTable(byScenario)}

### Rows By Model And Scenario

${markdownTable(byModelScenario)}

## Error Notes

- Non-null \`errorNote\` values: ${nonNullErrors.length}

${nonNullErrors.length ? markdownTable(nonNullErrors.map((row) => ({ response_id: row.response_id, status: row.status, errorNote: row.errorNote }))) : "No non-null error notes were found in the final merged dataset."}

## MFT Coding Methodology

Qualitative responses were coded with two independent OpenRouter-hosted LLM coders that were not among the evaluated GPT-4o, Claude Sonnet, Gemini Flash, or Gemini Pro model families. This was done to reduce model-contamination risk between evaluated models and coding models. The primary coder was \`meta-llama/llama-3.3-70b-instruct\`; the second coder for reliability was \`deepseek/deepseek-chat\`. Both received the same structured Moral Foundations Theory coding prompt and were required to output exactly one of the five allowed labels.

Rows with exact model agreement were accepted directly. Invalid outputs and disagreements were manually adjudicated using the documented adjudication file and cluster rules, then merged into \`full_merged_with_ai_mft_codes.csv\`.

### Coding Reliability Before Adjudication

- Total paired responses coded: ${codingRows.length}
- Invalid paired rows excluded from kappa: ${kappa.invalidRows}
- Valid paired rows: ${kappa.validRows}
- Exact agreement percentage: ${kappa.percentAgreement}
- Cohen's kappa: ${kappa.kappa}
- Cohen's kappa 95% bootstrap CI: [${kappa.ciLower}, ${kappa.ciUpper}]

### Final Coding Sources After Adjudication

${markdownTable(codingSources)}
`;
}

function allResults(analysis: Record<string, Row[]>) {
  const sections = Object.entries(analysis).map(([name, rows]) => `## ${name}\n\n${markdownTable(rows)}\n`).join("\n");
  return `# All Statistical Results\n\nAll tables are copied from the finalized CSV outputs without rounding numeric strings beyond what is present in the source files.\n\n${sections}`;
}

function headlineFindings(analysis: Record<string, Row[]>) {
  const statisticalCandidates: Array<Row & { source: string }> = [
    ...analysis.language_effect.map((row) => ({ source: "language_effect", ...row })),
    ...analysis.framing_effect.map((row) => ({ source: "framing_effect", ...row })),
    ...analysis.reasoning_effect.map((row) => ({ source: "reasoning_effect", ...row })),
    ...analysis.foundation_breakdown.map((row) => ({ source: "foundation_breakdown", ...row })),
    ...analysis.model_comparison.map((row) => ({ source: "model_comparison", ...row }))
  ];
  const statisticalRows = statisticalCandidates
    .filter((row) => row.cohens_d && Number.isFinite(Number(row.cohens_d)) && row.n && Number(row.n) > 1)
    .sort((a, b) => {
      const d = Math.abs(Number(b.cohens_d)) - Math.abs(Number(a.cohens_d));
      if (d !== 0) return d;
      return Number(a.p_value || 1) - Number(b.p_value || 1);
    });
  const topStat = statisticalRows.slice(0, 8).map((row, index) => {
    const subject = [
      row.source,
      row.effect_type ? `effect=${row.effect_type}` : "",
      row.model_key ? `model=${row.model_key}` : "",
      row.language ? `language=${row.language}` : "",
      row.mft_foundation && row.mft_foundation !== "all" ? `foundation=${row.mft_foundation}` : ""
    ].filter(Boolean).join(", ");
    return `${index + 1}. ${subject} showed mean_diff=${row.mean_diff}, 95% CI=[${row.ci_lower}, ${row.ci_upper}], p=${row.p_value}, Cohen's d=${row.cohens_d}, n=${row.n}.`;
  });

  const divergenceRows = analysis.reference_divergence
    .filter((row) => row.mean_absolute_difference)
    .sort((a, b) => Number(b.mean_absolute_difference) - Number(a.mean_absolute_difference))
    .slice(0, 2)
    .map((row, index) => `${topStat.length + index + 1}. reference_divergence (${row.group_by}, model=${row.model_key || "all"}, language=${row.language || "all"}, condition_type=${row.condition_type || "all"}) had mean absolute divergence=${row.mean_absolute_difference}, n=${row.n}; largest_specific_condition=${row.largest_specific_condition}.`);

  return `# Headline Findings\n\nRanked primarily by absolute Cohen's d for inferential effect tables, with the largest reference-divergence summaries appended.\n\n${[...topStat, ...divergenceRows].join("\n")}\n`;
}

async function figuresInventory() {
  const figureFiles = [
    ["results/figures/01-language-effects.svg", "Legacy SVG showing language effects from the original analysis run."],
    ["results/figures/02-framing-effects.svg", "Legacy SVG showing framing effects from the original analysis run."],
    ["results/figures/03-reasoning-effects.svg", "Legacy SVG showing reasoning-language effects from the original analysis run."],
    ["results/figures/04-reference-divergence.svg", "Legacy SVG showing reference-model divergence from the original analysis run."],
    ["results/figures/figure1_language_effect_by_model.png", "Publication figure: grouped bars of input-language rating shifts by evaluated model."],
    ["results/figures/figure1_language_effect_by_model.pdf", "PDF version of Figure 1."],
    ["results/figures/figure1_language_effect_by_model.svg", "SVG version of Figure 1."],
    ["results/figures/figure2_framing_effect_heatmap.png", "Publication figure: heatmap of cultural-adaptation effects by language and foundation."],
    ["results/figures/figure2_framing_effect_heatmap.pdf", "PDF version of Figure 2."],
    ["results/figures/figure2_framing_effect_heatmap.svg", "SVG version of Figure 2."],
    ["results/figures/figure3_reasoning_language_effect_by_model.png", "Publication figure: grouped bars of reasoning-language effects by evaluated model."],
    ["results/figures/figure3_reasoning_language_effect_by_model.pdf", "PDF version of Figure 3."],
    ["results/figures/figure3_reasoning_language_effect_by_model.svg", "SVG version of Figure 3."],
    ["results/figures/figure4_reference_model_divergence.png", "Publication figure: mean absolute divergence from Gemini Pro by evaluated model and condition type."],
    ["results/figures/figure4_reference_model_divergence.pdf", "PDF version of Figure 4."],
    ["results/figures/figure4_reference_model_divergence.svg", "SVG version of Figure 4."],
    ["results/figures/figure5_foundation_transition_heatmap.png", "Publication figure: designed-to-invoked MFT transition heatmaps by source model."],
    ["results/figures/figure5_foundation_transition_heatmap.pdf", "PDF version of Figure 5."],
    ["results/figures/figure5_foundation_transition_heatmap.svg", "SVG version of Figure 5."],
    ["results/figures/data/figure1_language_effect_by_model.csv", "Underlying data table for Figure 1."],
    ["results/figures/data/figure2_framing_heatmap.csv", "Underlying data table for Figure 2."],
    ["results/figures/data/figure3_reasoning_effect_by_model.csv", "Underlying data table for Figure 3."],
    ["results/figures/data/figure4_reference_divergence.csv", "Underlying data table for Figure 4."],
    ["results/figures/data/figure5_foundation_transitions.csv", "Underlying data table for Figure 5."]
  ];

  const rows = await Promise.all(
    figureFiles.map(async ([relativePath, description]) => {
      const file = path.join(root, relativePath);
      try {
        const info = await stat(file);
        return { path: relativePath, exists: true, non_empty: info.size > 0, bytes: info.size, description };
      } catch {
        return { path: relativePath, exists: false, non_empty: false, bytes: 0, description };
      }
    })
  );

  return `# Figures Inventory\n\n${markdownTable(rows)}\n`;
}

function exampleResponses(rows: Row[], preCodedRows: Row[]) {
  const qualitative = rows.filter((row) => row.taskType === "qualitative" && row.rawOutput);
  const selected: Array<Row & { selection_reason: string }> = [];
  const add = (row: Row | undefined, reason: string) => {
    if (!row || selected.some((entry) => entry.response_id === row.response_id)) return;
    selected.push({ ...row, selection_reason: reason });
  };

  for (const row of qualitative.filter((row) => row.mft_foundation !== row.ai_mft_final_label).slice(0, 6)) {
    add(row, "Coded foundation diverges from designed foundation.");
  }

  const ratingRows = preCodedRows.filter((row) => row.taskType === "rating" && row.parsedRating);
  const ratingMap = new Map(ratingRows.map((row) => [ratingKey(row), Number(row.parsedRating)]));
  const languageDiffs = ratingRows
    .filter((row) => row.scenarioVersion === "translation" && row.reasoningLang === "en" && row.inputLang !== "en")
    .map((row) => ({ row, diff: Number(row.parsedRating) - (ratingMap.get(`${row.modelKey}|${row.scenarioId}|en_en`) ?? NaN) }))
    .filter((entry) => Number.isFinite(entry.diff) && qualitative.some((row) => row.modelKey === entry.row.modelKey && row.scenarioId === entry.row.scenarioId && row.conditionId === entry.row.conditionId))
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))
    .slice(0, 5);
  for (const entry of languageDiffs) {
    add(
      qualitative.find((row) => row.modelKey === entry.row.modelKey && row.scenarioId === entry.row.scenarioId && row.conditionId === entry.row.conditionId),
      `Large language-effect rating difference for this model/scenario/condition: ${entry.diff}.`
    );
  }

  const referenceMap = new Map(ratingRows.filter((row) => row.modelKey === "gemini_pro").map((row) => [`${row.scenarioId}|${row.conditionId}`, Number(row.parsedRating)]));
  const divergences = ratingRows
    .filter((row) => row.modelKey !== "gemini_pro")
    .map((row) => ({ row, diff: Math.abs(Number(row.parsedRating) - (referenceMap.get(`${row.scenarioId}|${row.conditionId}`) ?? NaN)) }))
    .filter((entry) => Number.isFinite(entry.diff) && qualitative.some((row) => row.modelKey === entry.row.modelKey && row.scenarioId === entry.row.scenarioId && row.conditionId === entry.row.conditionId))
    .sort((a, b) => b.diff - a.diff)
    .slice(0, 5);
  for (const entry of divergences) {
    add(
      qualitative.find((row) => row.modelKey === entry.row.modelKey && row.scenarioId === entry.row.scenarioId && row.conditionId === entry.row.conditionId),
      `Large absolute divergence from Gemini Pro reference rating: ${entry.diff}.`
    );
  }

  const examples = selected.slice(0, 15);
  return `# Example Qualitative Responses\n\n${examples
    .map(
      (row, index) => `## Example ${index + 1}: ${row.scenarioId} / ${row.conditionId} / ${row.modelKey}

- Selection reason: ${row.selection_reason}
- Model: ${row.modelKey}
- Scenario ID: ${row.scenarioId}
- Condition ID: ${row.conditionId}
- Input language: ${row.inputLang}
- Reasoning language: ${row.reasoningLang}
- Designed foundation: ${row.mft_foundation}
- Coded foundation: ${row.ai_mft_final_label}
- Coding source: ${row.ai_mft_code_source}

### Qualitative Response

${row.rawOutput}
`
    )
    .join("\n")}`;
}

function methodsRawMaterials(scenarios: Awaited<ReturnType<typeof loadScenarioMetadata>>) {
  const systemPromptRows = allSystemPrompts().map((entry, index) => ({
    prompt_number: index + 1,
    input_language: entry.inputLang,
    reasoning_language: entry.reasoningLang,
    system_prompt: entry.prompt
  }));
  const ratingRows = languageCodes.map((code) => ({
    language: code,
    rating_instruction: buildUserPrompt("[SCENARIO_TEXT]", code, "rating").replace("[SCENARIO_TEXT]\n\n", "")
  }));
  const categoryBreakdown = group(
    scenarios.map((scenario) => ({ mft_category: scenario.mft_category, mft_foundation: scenario.mft_foundation })),
    ["mft_category", "mft_foundation"]
  ).map((entry) => ({ mft_category: entry.mft_category, mft_foundation: entry.mft_foundation, scenarios: entry.rows.length }));

  const qualitativeTargets = ["S01", "S06", "S11", "S16", "S21", "S26", "S28", "S29", "S30", "S34"];

  return `# Methods Raw Materials

## Exact System Prompts Used

${markdownTable(systemPromptRows)}

## Exact Rating Instruction Text Per Language

${markdownTable(ratingRows)}

## Scenario Count And MFT Category Breakdown

- Total scenarios: ${scenarios.length}
- Qualitative target scenarios in the final data: ${qualitativeTargets.join(", ")}

${markdownTable(categoryBreakdown)}

## Condition Design

The design used 25 conditions per scenario: one English baseline condition (\`en_en\`) plus, for each of six non-English languages, four conditions crossing scenario version and reasoning language: literal translation with English reasoning, literal translation with same-language reasoning, cultural adaptation with English reasoning, and cultural adaptation with same-language reasoning. This holds either scenario content or reasoning language constant depending on the effect being estimated.

## Data Processing Pipeline

1. Scenario CSVs were loaded and normalized from \`data/scenarios.csv\` and \`data/scenarios_extension.csv\`.
2. Work units were generated for all models, scenarios, and conditions using \`generateConditions()\`.
3. Rating prompts requested a single 1-7 blameworthiness integer; qualitative prompts requested a 2-3 sentence moral explanation.
4. API calls were sent to OpenRouter with pinned model strings and temperature 0.
5. Rating outputs were parsed with digit normalization; malformed ratings were retried up to three attempts.
6. Qualitative outputs were stored as raw model text.
7. Original and extension runs were exported into processed rating and qualitative CSVs.
8. \`post-expansion-analysis\` merged original plus extension results into \`results/processed/full_merged.csv\` and regenerated the six statistical result tables.
9. Research figures 1-4 were generated from \`results/figures/data/*.csv\`.
10. Qualitative responses were coded by two independent non-evaluated LLM coders using the same MFT guide prompt.
11. Invalid labels and disagreements were manually adjudicated, producing \`ai_mft_codes_adjudicated.csv\`.
12. Final adjudicated MFT codes were merged into \`full_merged_with_ai_mft_codes.csv\`.
13. Final coded analysis generated foundation match rates, transition matrices, and Figure 5.
`;
}

function limitations(rows: Row[], languageReview: any) {
  const qualitative = rows.filter((row) => row.taskType === "qualitative");
  const possibleTruncated = qualitative.filter((row) => looksPossiblyTruncated(row.rawOutput));
  const qualitativeScenarios = unique(qualitative.map((row) => row.scenarioId));
  const ratingRows = rows.filter((row) => row.taskType === "rating");
  const sampleSizes = [
    { quantity: "rating rows per scenario/model across all 25 conditions", n: 25 },
    { quantity: "rating rows per scenario across 4 models", n: 100 },
    { quantity: "ratings per language/model effect estimate", n: 50 },
    { quantity: "qualitative rows per designated qualitative scenario across 25 conditions x 4 models", n: 100 },
    { quantity: "qualitative target scenarios", n: qualitativeScenarios.length }
  ];

  return `# Limitations Checklist

## Current Data And Analysis Caveats

- MFT labels were coded independently by two human coders and finalized through human adjudication. Historical fields containing \`ai_mft\`, \`llama\`, or \`deepseek\` do not describe the final coding process.
- The final qualitative dataset covers ${qualitativeScenarios.length} designated target scenarios (${qualitativeScenarios.join(", ")}), not all 50 scenarios.
- The original requested 7,500 rating-row expectation was arithmetically inconsistent with the final design; the actual final rating data contain ${ratingRows.length} rows: 50 scenarios x 25 conditions x 4 models.
- Gemini Pro is used as the reference model in reference-divergence analyses; it is not one of the three primary evaluated models for the main effect estimates.
- Language-compliance review covered ${languageReview?.summary?.reviewed ?? "NA"} model-language samples, with ${languageReview?.summary?.correct ?? "NA"} marked correct and ${languageReview?.summary?.truncated ?? "NA"} marked truncated.
- Possible qualitative truncation by simple terminal-punctuation heuristic: ${possibleTruncated.length}/${qualitative.length} qualitative responses. This heuristic is conservative and should be interpreted alongside the manual language-compliance review.
- Qualitative generation used finite max-token limits: 260 for non-Gemini models and 900 for Gemini-family models, according to \`lib/qualitative.ts\`.
- Arabic Condition B/C scenario text and Arabic prompts are marked final with native-speaker sign-off on 2026-06-24 in the documentation/language metadata.
- Arabic is right-to-left; all downstream rendering and paper examples should preserve Unicode text direction and avoid manual reversal or script stripping.
- Rating outputs are integer-only 1-7 blameworthiness judgments; this simplifies parsing but limits nuance.
- Effects are paired within scenario/model where applicable; small slices such as per-language per-model effects use n=50, while foundation-broken subsets can be smaller.
- Some old documentation still refers to earlier expected API volume and undecided qualitative subsample choices; the final data supersede those notes.

## Sample Sizes To Report

${markdownTable(sampleSizes)}

## Historical/Open Items Found In Documentation

- Earlier README/PROJECT_SPEC notes said qualitative MFT coding should be human-reviewed and that expanding the qualitative subsample was undecided; the final workflow used independent human coding and human adjudication over 1,000 qualitative rows.
- The archived PROJECT_SPEC warns not to treat automated MFT classification as ground truth; final labels are human-adjudicated qualitative codes.
- PROJECT_SPEC warns language compliance cannot be perfectly verified automatically; the final language-compliance review is a sampled manual/Codex-assisted inspection, not an exhaustive proof.
- PROJECT_SPEC emphasizes UTF-8/non-Latin script validation and Arabic RTL handling; preserve this as a reproducibility caveat.

## Possibly Truncated Qualitative Rows Heuristic

The following table lists up to 25 rows whose raw output does not end in common sentence-final punctuation.

${markdownTable(possibleTruncated.slice(0, 25).map((row) => ({ response_id: row.response_id, model_key: row.modelKey, scenario_id: row.scenarioId, condition_id: row.conditionId, raw_output_tail: row.rawOutput.slice(-120) })))}
`;
}

function reliabilityWithBootstrap(rows: Row[]) {
  const valid = rows.filter((row) => row.llama_label && row.deepseek_label && row.llama_label !== "INVALID" && row.deepseek_label !== "INVALID");
  const invalidRows = rows.filter((row) => row.llama_label === "INVALID" || row.deepseek_label === "INVALID").length;
  const kappa = computeKappa(valid);
  const exactAgreement = valid.filter((row) => row.llama_label === row.deepseek_label).length / valid.length;
  const estimates: number[] = [];
  let seed = 20260630;
  for (let i = 0; i < 1000; i += 1) {
    const sample: Row[] = [];
    for (let j = 0; j < valid.length; j += 1) {
      seed = lcg(seed);
      sample.push(valid[Math.floor((seed / 0xffffffff) * valid.length)]);
    }
    estimates.push(computeKappa(sample));
  }
  estimates.sort((a, b) => a - b);
  return {
    invalidRows,
    validRows: valid.length,
    percentAgreement: `${(exactAgreement * 100).toFixed(2)}%`,
    kappa: kappa.toFixed(4),
    ciLower: percentile(estimates, 0.025).toFixed(4),
    ciUpper: percentile(estimates, 0.975).toFixed(4)
  };
}

function computeKappa(rows: Row[]) {
  const matrix = mftCodes.map(() => mftCodes.map(() => 0));
  for (const row of rows) {
    const a = mftCodes.indexOf(row.llama_label as never);
    const b = mftCodes.indexOf(row.deepseek_label as never);
    if (a >= 0 && b >= 0) matrix[a][b] += 1;
  }
  const n = rows.length;
  const observed = matrix.reduce((total, row, index) => total + row[index], 0) / n;
  const expected = mftCodes.reduce((total, _label, index) => {
    const rowTotal = matrix[index].reduce((sum, value) => sum + value, 0);
    const columnTotal = matrix.reduce((sum, row) => sum + row[index], 0);
    return total + (rowTotal / n) * (columnTotal / n);
  }, 0);
  return (observed - expected) / (1 - expected);
}

function ratingKey(row: Row) {
  return `${row.modelKey}|${row.scenarioId}|${row.conditionId}`;
}

function looksPossiblyTruncated(value = "") {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return !/[.!?。！？।؟۔"')\]\u0964\u0965]$/.test(trimmed);
}

function group<T extends Record<string, any>>(rows: T[], keys: string[]) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keys.map((field) => row[field] ?? "").join("\u0001");
    map.set(key, [...(map.get(key) ?? []), row]);
  }
  return [...map.entries()]
    .map(([key, groupedRows]) => {
      const values = key.split("\u0001");
      return Object.assign(Object.fromEntries(keys.map((field, index) => [field, values[index]])), { rows: groupedRows });
    })
    .sort((a, b) => keys.map((key) => String(a[key]).localeCompare(String(b[key]))).find((value) => value !== 0) ?? 0);
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function percentile(values: number[], p: number) {
  const index = (values.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  if (lo === hi) return values[lo];
  return values[lo] + (values[hi] - values[lo]) * (index - lo);
}

function lcg(seed: number) {
  return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function markdownTable(rows: MarkdownTableRow[]) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.map(escapeMarkdownCell).join(" |")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => escapeMarkdownCell(row[header])).join(" | ")} |`)
  ].join("\n");
}

function escapeMarkdownCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return text.replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
