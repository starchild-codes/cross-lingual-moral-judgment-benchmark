import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mftCodes, type MftCode } from "./mft-labels";
import { loadScenarioMetadata } from "./scenarios";
import type { ScenarioVersion } from "./schemas";

export type CodingStatus = "coded" | "skipped";

export type CodingResponse = {
  responseId: string;
  runId: string;
  modelKey: string;
  scenarioId: string;
  mftCategory: string;
  mftFoundation: string;
  conditionId: string;
  inputLang: string;
  reasoningLang: string;
  scenarioVersion: ScenarioVersion;
  designedFoundation: string;
  scenarioTextEnglish: string;
  scenarioText: string;
  response: string;
};

export type CodingDecision = {
  responseId: string;
  runId: string;
  modelKey: string;
  scenarioId: string;
  conditionId: string;
  inputLang: string;
  reasoningLang: string;
  scenarioVersion: ScenarioVersion;
  code: MftCode | "";
  status: CodingStatus;
  codedAt: string;
};

export type KappaResult = {
  matched: number;
  percentAgreement: number;
  kappa: number | null;
  labels: MftCode[];
  confusionMatrix: number[][];
};

const processedRoot = path.join(process.cwd(), "results", "processed");
const defaultQualitativeFile = path.join(processedRoot, "full_merged.csv");
export const defaultCodesFile = path.join(processedRoot, "codes_coder1.csv");
export const coder2CodesFile = path.join(processedRoot, "codes_coder2.csv");

export async function loadCodingResponses(filePath = defaultQualitativeFile, coder = "1", full = false): Promise<CodingResponse[]> {
  const [csv, scenarios] = await Promise.all([readFile(filePath, "utf8"), loadScenarioMetadata()]);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Array<Record<string, string>>;

  const responses = rows
    .filter((row) => row.taskType === "qualitative" && row.status === "succeeded")
    .map((row) => {
      const scenarioId = row.scenarioId;
      const scenario = scenarioById.get(scenarioId);
      const scenarioVersion = normalizeScenarioVersion(row.scenarioVersion);
      return {
        responseId: row.response_id || buildResponseId(row),
        runId: row.runId,
        modelKey: row.modelKey,
        scenarioId,
        mftCategory: row.mft_category,
        mftFoundation: row.mft_foundation,
        conditionId: row.conditionId,
        inputLang: row.inputLang,
        reasoningLang: row.reasoningLang,
        scenarioVersion,
        designedFoundation: row.mft_foundation,
        scenarioTextEnglish: scenario?.text_en ?? "",
        scenarioText: scenario?.text_en ?? "",
        response: row.rawOutput ?? ""
      };
    });
  return full ? responses : validationSubsample(responses);
}

export async function loadCodingDecisions(filePath = defaultCodesFile): Promise<CodingDecision[]> {
  try {
    const csv = await readFile(filePath, "utf8");
    const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Array<Record<string, string>>;
    return rows.map((row) => ({
      responseId: row.responseId || row.response_id,
      runId: row.runId,
      modelKey: row.modelKey,
      scenarioId: row.scenarioId,
      conditionId: row.conditionId,
      inputLang: row.inputLang,
      reasoningLang: row.reasoningLang,
      scenarioVersion: normalizeScenarioVersion(row.scenarioVersion),
      code: isMftCode(row.code) ? row.code : "",
      status: row.status === "skipped" ? "skipped" : "coded",
      codedAt: row.codedAt
    }));
  } catch {
    return [];
  }
}

export async function saveCodingDecision(decision: CodingDecision, filePath = defaultCodesFile) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const decisions = await loadCodingDecisions(filePath);
  const index = decisions.findIndex((entry) => entry.responseId === decision.responseId);
  if (index >= 0) decisions[index] = decision;
  else decisions.push(decision);
  await writeFile(filePath, stringifyDecisions(decisions), "utf8");
}

export function computeKappa(coderA: CodingDecision[], coderB: CodingDecision[]): KappaResult {
  const byResponse = new Map(coderB.filter((row) => row.status === "coded" && isMftCode(row.code)).map((row) => [row.responseId, row]));
  const pairs = coderA
    .filter((row) => row.status === "coded" && isMftCode(row.code))
    .map((row) => [row, byResponse.get(row.responseId)] as const)
    .filter((pair): pair is readonly [CodingDecision, CodingDecision] => Boolean(pair[1]));

  const labels = [...mftCodes];
  const matrix = labels.map(() => labels.map(() => 0));
  for (const [a, b] of pairs) {
    matrix[labels.indexOf(a.code as MftCode)][labels.indexOf(b.code as MftCode)] += 1;
  }

  const matched = pairs.length;
  if (matched === 0) return { matched, percentAgreement: 0, kappa: null, labels, confusionMatrix: matrix };

  const observedAgreement = matrix.reduce((sum, row, rowIndex) => sum + row[rowIndex], 0) / matched;
  const expectedAgreement = labels.reduce((sum, _label, index) => {
    const rowTotal = matrix[index].reduce((rowSum, value) => rowSum + value, 0);
    const colTotal = matrix.reduce((colSum, row) => colSum + row[index], 0);
    return sum + (rowTotal / matched) * (colTotal / matched);
  }, 0);
  const kappa = expectedAgreement === 1 ? null : (observedAgreement - expectedAgreement) / (1 - expectedAgreement);

  return {
    matched,
    percentAgreement: observedAgreement * 100,
    kappa,
    labels,
    confusionMatrix: matrix
  };
}

export function isMftCode(value: string): value is MftCode {
  return mftCodes.includes(value as MftCode);
}

function buildResponseId(row: Record<string, string>) {
  return [row.runId, row.modelKey, row.scenarioId, row.conditionId, row.taskType].join("__");
}

function validationSubsample(responses: CodingResponse[]) {
  const groups = new Map<string, CodingResponse[]>();
  for (const response of responses) {
    const key = `${response.scenarioId}|${response.modelKey}`;
    groups.set(key, [...(groups.get(key) ?? []), response]);
  }
  return [...groups.values()]
    .flatMap((group) => [...group].sort((a, b) => seededHash(a.responseId) - seededHash(b.responseId)).slice(0, 5))
    .sort((a, b) => a.responseId.localeCompare(b.responseId));
}

function seededHash(value: string) {
  let hash = 2166136261;
  for (const char of `mft-coder2-v1:${value}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normalizeScenarioVersion(value: string): ScenarioVersion {
  if (value === "translation" || value === "adapted") return value;
  return "en";
}

function stringifyDecisions(decisions: CodingDecision[]) {
  const header = ["responseId", "runId", "modelKey", "scenarioId", "conditionId", "inputLang", "reasoningLang", "scenarioVersion", "code", "status", "codedAt"];
  const rows = decisions
    .sort((a, b) => a.responseId.localeCompare(b.responseId))
    .map((decision) => header.map((column) => csvEscape(String(decision[column as keyof CodingDecision] ?? ""))).join(","));
  return `${header.join(",")}\n${rows.join("\n")}\n`;
}

function csvEscape(value: string) {
  if (!/[",\r\n]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}
