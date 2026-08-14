import "../lib/config";
import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mftCodes, type MftCode } from "../lib/mft-labels";
import { loadScenarioMetadata } from "../lib/scenarios";

type Row = Record<string, string>;
type Label = MftCode | "INVALID";
type CodingOutputRow = {
  response_id: string;
  scenario_id: string;
  model_evaluated: string;
  language: string;
  condition: string;
  designed_label: string;
  scenario_text_en: string;
  qualitative_response: string;
  llama_label: Label | "";
  deepseek_label: Label | "";
  agreement: string;
};

const primaryCoder = "meta-llama/llama-3.3-70b-instruct";
const secondCoder = "deepseek/deepseek-chat";
const processedDir = path.join(process.cwd(), "results", "processed");
const inputFile = process.env.AI_MFT_INPUT ?? path.join(processedDir, "full_merged.csv");
const outputDir = path.join(processedDir, "ai_mft_coding");
const outputFile = path.join(outputDir, "ai_mft_codes.csv");
const disagreementFile = path.join(outputDir, "ai_mft_disagreements.csv");
const summaryFile = path.join(outputDir, "ai_mft_summary_report.txt");
const allowedLabels = [...mftCodes];

async function main() {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error("OPENROUTER_API_KEY must be set in the environment or .env.local. The key is never written to disk.");
  }

  await mkdir(outputDir, { recursive: true });
  const [responses, existing] = await Promise.all([loadQualitativeResponses(), loadExistingOutputs()]);

  // Resume behavior: if ai_mft_codes.csv already exists, previously coded rows are
  // reused and only missing response_id values are sent to OpenRouter.
  const completed = new Map(existing.map((row) => [row.response_id, row]));

  // Optional safety valve for testing: AI_MFT_LIMIT=5 codes only five new rows.
  // Leave unset for the full 1,000-response run.
  const limit = Number(process.env.AI_MFT_LIMIT ?? responses.length);

  console.log(`AI MFT coding input: ${inputFile}`);
  console.log(`Responses available: ${responses.length}`);
  console.log(`Already coded/resumable rows: ${completed.size}`);
  console.log(`Primary coder: ${primaryCoder}`);
  console.log(`Second coder: ${secondCoder}`);

  let processedLlama = 0;
  for (const response of responses) {
    const existing = completed.get(response.response_id);
    if (existing?.llama_label) continue;
    if (processedLlama >= limit) break;

    const llamaLabel = await codeWithModel(primaryCoder, response);
    const output: CodingOutputRow = {
      response_id: response.response_id,
      scenario_id: response.scenario_id,
      model_evaluated: response.model_evaluated,
      language: response.language,
      condition: response.condition,
      designed_label: response.designed_label,
      scenario_text_en: response.scenario_text_en,
      qualitative_response: response.qualitative_response,
      llama_label: llamaLabel,
      deepseek_label: existing?.deepseek_label ?? "",
      agreement: agreementFor(llamaLabel, existing?.deepseek_label ?? "")
    };

    completed.set(output.response_id, output);
    await writeOutputs([...completed.values()].sort((a, b) => a.response_id.localeCompare(b.response_id)));
    processedLlama += 1;
    console.log(`llama ${countWithLabel([...completed.values()], "llama_label")}/${responses.length} | ${output.response_id} | llama=${llamaLabel}`);
  }

  let processedDeepseek = 0;
  for (const response of responses) {
    const existing = completed.get(response.response_id);
    if (!existing?.llama_label || existing.deepseek_label) continue;
    if (processedDeepseek >= limit) break;

    const deepseekLabel = await codeWithModel(secondCoder, response);
    const output: CodingOutputRow = {
      ...existing,
      deepseek_label: deepseekLabel,
      agreement: agreementFor(existing.llama_label, deepseekLabel)
    };

    completed.set(output.response_id, output);
    await writeOutputs([...completed.values()].sort((a, b) => a.response_id.localeCompare(b.response_id)));
    processedDeepseek += 1;
    console.log(
      `deepseek ${countWithLabel([...completed.values()], "deepseek_label")}/${responses.length} | ${output.response_id} | llama=${output.llama_label} deepseek=${deepseekLabel}`
    );
  }

  await writeOutputs([...completed.values()].sort((a, b) => a.response_id.localeCompare(b.response_id)));
  console.log(`Done. Results saved under ${outputDir}`);
}

async function loadQualitativeResponses() {
  const [csv, scenarios] = await Promise.all([readFile(inputFile, "utf8"), loadScenarioMetadata()]);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Row[];

  return rows
    .filter((row) => row.taskType === "qualitative" && row.status === "succeeded")
    .map((row) => {
      const scenario = scenarioById.get(row.scenarioId);
      return {
        response_id: row.response_id || [row.runId, row.modelKey, row.scenarioId, row.conditionId, row.taskType].join("__"),
        scenario_id: row.scenarioId,
        model_evaluated: row.modelKey,
        language: row.inputLang,
        condition: row.conditionId,
        designed_label: row.mft_foundation,
        scenario_text_en: scenario?.text_en ?? "",
        qualitative_response: row.rawOutput ?? ""
      };
    });
}

async function loadExistingOutputs(): Promise<CodingOutputRow[]> {
  try {
    const csv = await readFile(outputFile, "utf8");
    return parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as CodingOutputRow[];
  } catch {
    return [];
  }
}

async function codeWithModel(model: string, response: Awaited<ReturnType<typeof loadQualitativeResponses>>[number]): Promise<Label> {
  // The first pass uses the same structured prompt for both independent coders.
  // If a model emits anything except one exact allowed label, a stricter retry
  // is attempted once; persistent failures are preserved as INVALID.
  const first = await callCoder(model, buildPrompt(response, false));
  const firstLabel = normalizeLabel(first);
  if (firstLabel) return firstLabel;

  const retry = await callCoder(model, buildPrompt(response, true));
  return normalizeLabel(retry) ?? "INVALID";
}

async function callCoder(model: string, prompt: string): Promise<string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    "Content-Type": "application/json"
  };
  if (process.env.OPENROUTER_SITE_URL) headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  if (process.env.OPENROUTER_SITE_NAME) headers["X-Title"] = process.env.OPENROUTER_SITE_NAME;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are an independent qualitative coding assistant. Output exactly one allowed label and nothing else."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0,
      max_tokens: 16
    })
  });

  const raw = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`OpenRouter ${response.status} for ${model}: ${JSON.stringify(raw)}`);
  const content = raw?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}

function buildPrompt(response: Awaited<ReturnType<typeof loadQualitativeResponses>>[number], retry: boolean) {
  const retryInstruction = retry
    ? "\nYour previous output was invalid. You must output exactly one of the five labels, with no punctuation, explanation, markdown, or extra words.\n"
    : "";

  return `Moral Foundations Theory coding guide:

Care/Harm: References to care, compassion, suffering, protection, neglect, injury, vulnerability, or preventing harm.
Loyalty/Betrayal: References to loyalty, trust, betrayal, group obligation, friendship, confidentiality, solidarity, or abandonment of allies.
Authority/Subversion: References to authority, hierarchy, obedience, respect for parents/elders/institutions, duty, tradition, or defiance.
Fairness/Cheating: References to fairness, justice, rights, equality, merit, bias, cheating, corruption, or unfair advantage.
Sanctity/Degradation: References to sacredness, purity, pollution, contamination, desecration, religious sanctity, or bodily/spiritual degradation.

English scenario text for context:
${response.scenario_text_en}

Qualitative response to code:
${response.qualitative_response}
${retryInstruction}
Allowed labels:
Care/Harm
Loyalty/Betrayal
Authority/Subversion
Fairness/Cheating
Sanctity/Degradation

Output exactly one label from the allowed labels and nothing else.`;
}

function normalizeLabel(value: string): MftCode | null {
  const trimmed = value.trim();
  return allowedLabels.includes(trimmed as MftCode) ? (trimmed as MftCode) : null;
}

async function writeOutputs(rows: CodingOutputRow[]) {
  // These are derived coding outputs only. The original evaluated-response
  // dataset is never overwritten by this script.
  await writeFile(outputFile, toCsv(rows), "utf8");
  const disagreements = rows.filter((row) => row.llama_label && row.deepseek_label && row.llama_label !== row.deepseek_label);
  await writeFile(disagreementFile, toCsv(disagreements), "utf8");
  await writeFile(summaryFile, buildSummary(rows), "utf8");
}

function buildSummary(rows: CodingOutputRow[]) {
  const paired = rows.filter((row) => row.llama_label && row.deepseek_label);
  const valid = paired.filter((row) => row.llama_label !== "INVALID" && row.deepseek_label !== "INVALID");
  const invalidRows = paired.length - valid.length;
  const agreements = valid.filter((row) => row.llama_label === row.deepseek_label).length;
  const exactAgreement = valid.length ? (agreements / valid.length) * 100 : 0;
  const kappa = computeKappa(valid);
  const disagreementCounts = new Map<string, number>();

  for (const row of valid) {
    if (row.llama_label === row.deepseek_label) continue;
    disagreementCounts.set(row.designed_label, (disagreementCounts.get(row.designed_label) ?? 0) + 1);
  }

  const lines = [
    "AI MFT coding summary",
    `Primary coder: ${primaryCoder}`,
    `Second coder: ${secondCoder}`,
    `Rows with Llama label: ${countWithLabel(rows, "llama_label")}`,
    `Rows with DeepSeek label: ${countWithLabel(rows, "deepseek_label")}`,
    `Total paired responses coded: ${paired.length}`,
    `Invalid outputs: ${invalidRows}`,
    `Valid paired rows for reliability: ${valid.length}`,
    `Exact agreement percentage: ${exactAgreement.toFixed(2)}%`,
    `Cohen's kappa: ${kappa === null ? "NA" : kappa.toFixed(4)}`,
    "",
    "Per-foundation disagreement counts:"
  ];

  for (const label of allowedLabels) {
    lines.push(`${label}: ${disagreementCounts.get(label) ?? 0}`);
  }

  return `${lines.join("\n")}\n`;
}

function computeKappa(rows: CodingOutputRow[]) {
  if (!rows.length) return null;
  const matrix = allowedLabels.map(() => allowedLabels.map(() => 0));
  for (const row of rows) {
    const a = allowedLabels.indexOf(row.llama_label as MftCode);
    const b = allowedLabels.indexOf(row.deepseek_label as MftCode);
    if (a >= 0 && b >= 0) matrix[a][b] += 1;
  }

  const n = rows.length;
  const observed = matrix.reduce((sum, row, index) => sum + row[index], 0) / n;
  const expected = allowedLabels.reduce((sum, _label, index) => {
    const rowTotal = matrix[index].reduce((inner, value) => inner + value, 0);
    const columnTotal = matrix.reduce((inner, row) => inner + row[index], 0);
    return sum + (rowTotal / n) * (columnTotal / n);
  }, 0);

  return expected === 1 ? null : (observed - expected) / (1 - expected);
}

function agreementFor(llamaLabel: Label | "", deepseekLabel: Label | "") {
  if (!llamaLabel || !deepseekLabel) return "";
  return String(llamaLabel !== "INVALID" && llamaLabel === deepseekLabel);
}

function countWithLabel(rows: CodingOutputRow[], column: "llama_label" | "deepseek_label") {
  return rows.filter((row) => row[column]).length;
}

function toCsv(rows: Array<Record<string, string>>) {
  const columns = [
    "response_id",
    "scenario_id",
    "model_evaluated",
    "language",
    "condition",
    "designed_label",
    "scenario_text_en",
    "qualitative_response",
    "llama_label",
    "deepseek_label",
    "agreement"
  ];
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
