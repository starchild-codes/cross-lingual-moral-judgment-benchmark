import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RunRecord, WorkUnit } from "./schemas";

const root = path.join(process.cwd(), "results", "processed");

async function ensureRoot() {
  await mkdir(root, { recursive: true });
}

export async function listRuns(): Promise<RunRecord[]> {
  await ensureRoot();
  try {
    const file = await readFile(path.join(root, "runs.json"), "utf8");
    return JSON.parse(file) as RunRecord[];
  } catch {
    return [];
  }
}

export async function saveRuns(runs: RunRecord[]) {
  await ensureRoot();
  await writeFile(path.join(root, "runs.json"), JSON.stringify(runs, null, 2), "utf8");
}

export async function getRun(runId: string) {
  const runs = await listRuns();
  return runs.find((run) => run.id === runId) ?? null;
}

export async function upsertRun(run: RunRecord) {
  const runs = await listRuns();
  const index = runs.findIndex((entry) => entry.id === run.id);
  if (index >= 0) runs[index] = run;
  else runs.unshift(run);
  await saveRuns(runs);
}

export async function loadWorkUnits(runId: string): Promise<WorkUnit[]> {
  await ensureRoot();
  try {
    const file = await readFile(path.join(root, `${runId}.work-units.json`), "utf8");
    return JSON.parse(file) as WorkUnit[];
  } catch {
    return [];
  }
}

export async function saveWorkUnits(runId: string, units: WorkUnit[]) {
  await ensureRoot();
  await writeFile(path.join(root, `${runId}.work-units.json`), JSON.stringify(units, null, 2), "utf8");
}
