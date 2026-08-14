import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadScenarioMetadata } from "../lib/scenarios";
import { listRuns, loadWorkUnits } from "../lib/storage";
import type { WorkUnit } from "../lib/schemas";

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>, columns: string[]) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
}

function cost(unit: WorkUnit) {
  const usage = unit.rawResponse && typeof unit.rawResponse === "object" ? (unit.rawResponse as { usage?: { cost?: number } }).usage : undefined;
  return typeof usage?.cost === "number" ? usage.cost : null;
}

async function main() {
  const runId = process.env.RUN_ID;
  if (!runId) throw new Error("Set RUN_ID to export a run.");
  const units = await loadWorkUnits(runId);
  const scenarios = await loadScenarioMetadata();
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.scenario_id, scenario]));
  const runs = await listRuns();
  const run = runs.find((entry) => entry.id === runId);

  const rawDir = path.join(process.cwd(), "results", "raw");
  const processedDir = path.join(process.cwd(), "results", "processed");
  await mkdir(rawDir, { recursive: true });
  await mkdir(processedDir, { recursive: true });

  await writeFile(path.join(processedDir, `${runId}.export.json`), JSON.stringify(units, null, 2), "utf8");

  const rawRows = units.map((unit) => {
    const scenario = scenarioById.get(unit.scenarioId);
    return {
      runId: unit.runId,
      mode: run?.mode ?? "",
      status: unit.status,
      attemptCount: unit.attemptCount,
      modelKey: unit.modelKey,
      modelString: unit.modelString,
      scenarioId: unit.scenarioId,
      mft_category: scenario?.mft_category ?? "",
      mft_foundation: scenario?.mft_foundation ?? "",
      conditionId: unit.conditionId,
      inputLang: unit.inputLang,
      reasoningLang: unit.reasoningLang,
      scenarioVersion: unit.scenarioVersion,
      taskType: unit.taskType,
      parsedRating: unit.parsedRating,
      rawOutput: unit.rawOutput,
      errorNote: unit.errorNote,
      cost: cost(unit),
      createdAt: unit.createdAt,
      updatedAt: unit.updatedAt
    };
  });

  const rawColumns = [
    "runId",
    "mode",
    "status",
    "attemptCount",
    "modelKey",
    "modelString",
    "scenarioId",
    "mft_category",
    "mft_foundation",
    "conditionId",
    "inputLang",
    "reasoningLang",
    "scenarioVersion",
    "taskType",
    "parsedRating",
    "rawOutput",
    "errorNote",
    "cost",
    "createdAt",
    "updatedAt"
  ];
  const rawCsv = toCsv(rawRows, rawColumns);
  await writeFile(path.join(rawDir, `${runId}.csv`), rawCsv, "utf8");
  if (run?.mode === "full") {
    const fullRunPath = path.join(rawDir, "full_run.csv");
    if (process.env.APPEND_TO_FULL_RUN === "true") {
      await appendCsvRows(fullRunPath, rawCsv);
    } else {
      await writeFile(fullRunPath, rawCsv, "utf8");
    }
  }
  if (run?.mode === "pilot") await writeFile(path.join(rawDir, "pilot_run.csv"), rawCsv, "utf8");

  const ratingRows = rawRows.filter((row) => row.taskType === "rating");
  await writeFile(path.join(processedDir, `${runId}.ratings.csv`), toCsv(ratingRows, rawColumns), "utf8");

  const qualitativeRows = rawRows.filter((row) => row.taskType === "qualitative");
  await writeFile(path.join(processedDir, `${runId}.qualitative.csv`), toCsv(qualitativeRows, rawColumns), "utf8");

  await readFile(path.join(processedDir, `${runId}.export.json`), "utf8");
  console.log(`Exported ${units.length} work units for ${runId}.`);
}

async function appendCsvRows(targetPath: string, csv: string) {
  const [, ...rows] = csv.trimEnd().split(/\r?\n/);
  const existing = await readFile(targetPath, "utf8").catch(() => "");
  if (!existing.trim()) {
    await writeFile(targetPath, csv, "utf8");
    return;
  }
  await writeFile(targetPath, `${existing.trimEnd()}\n${rows.join("\n")}\n`, "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
