import { modelConfig } from "./config";
import { generateConditions } from "./conditions";
import { buildMessages } from "./prompts";
import { getScenarioText, loadScenarios, qualitativeSubsample } from "./scenarios";
import { runQualitativeTask } from "./qualitative";
import { runRatingTask } from "./rating";
import { getRun, listRuns, loadWorkUnits, saveWorkUnits, upsertRun } from "./storage";
import { modelKeys, type RunRecord, type Scenario, type TaskType, type WorkUnit } from "./schemas";

function now() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createRun(mode: "pilot" | "full"): Promise<RunRecord> {
  const scenarios = await loadScenarios();
  const selectedScenarios = mode === "pilot" ? scenarios.slice(0, 5) : scenarios;
  return createRunForScenarios(mode, selectedScenarios, mode);
}

export async function createRunForScenarios(mode: "pilot" | "full", selectedScenarios: Scenario[], idPrefix: string = mode): Promise<RunRecord> {
  const qualitative = qualitativeSubsample(selectedScenarios);
  const conditions = generateConditions();
  const runId = makeId(idPrefix);
  const createdAt = now();
  const units: WorkUnit[] = [];

  for (const modelKey of modelKeys) {
    for (const condition of conditions) {
      for (const scenario of selectedScenarios) {
        const scenarioText = getScenarioText(scenario, condition);
        const taskType: TaskType = "rating";
        const missingText = !scenarioText.trim();
        units.push({
          id: `${runId}|${modelKey}|${scenario.scenario_id}|${condition.id}|${taskType}`,
          runId,
          status: missingText ? "skipped" : "pending",
          attemptCount: 0,
          createdAt,
          updatedAt: createdAt,
          modelKey,
          modelString: modelConfig[modelKey],
          scenarioId: scenario.scenario_id,
          conditionId: condition.id,
          inputLang: condition.inputLang,
          reasoningLang: condition.reasoningLang,
          scenarioVersion: condition.scenarioVersion,
          taskType,
          messages: missingText ? [] : buildMessages(condition, scenarioText, taskType),
          rawOutput: null,
          rawResponse: null,
          parsedRating: null,
          errorNote: missingText ? `Missing scenario text for ${scenario.scenario_id} / ${condition.id}` : null
        });
      }
      for (const scenario of qualitative) {
        const scenarioText = getScenarioText(scenario, condition);
        const taskType: TaskType = "qualitative";
        const missingText = !scenarioText.trim();
        units.push({
          id: `${runId}|${modelKey}|${scenario.scenario_id}|${condition.id}|${taskType}`,
          runId,
          status: missingText ? "skipped" : "pending",
          attemptCount: 0,
          createdAt,
          updatedAt: createdAt,
          modelKey,
          modelString: modelConfig[modelKey],
          scenarioId: scenario.scenario_id,
          conditionId: condition.id,
          inputLang: condition.inputLang,
          reasoningLang: condition.reasoningLang,
          scenarioVersion: condition.scenarioVersion,
          taskType,
          messages: missingText ? [] : buildMessages(condition, scenarioText, taskType),
          rawOutput: null,
          rawResponse: null,
          parsedRating: null,
          errorNote: missingText ? `Missing scenario text for ${scenario.scenario_id} / ${condition.id}` : null
        });
      }
    }
  }

  const run: RunRecord = { id: runId, mode, status: "created", createdAt, updatedAt: createdAt, totalUnits: units.length };
  await upsertRun(run);
  await saveWorkUnits(runId, units);
  return run;
}

export async function getRunDetail(runId: string) {
  const run = await getRun(runId);
  if (!run) return null;
  const units = await loadWorkUnits(runId);
  return { run, units };
}

export async function getRunsOverview() {
  return listRuns();
}

export async function executeRunStep(runId: string, limit = 5, concurrency = 1) {
  const detail = await getRunDetail(runId);
  if (!detail) throw new Error(`Run not found: ${runId}`);

  const { run, units } = detail;
  const pending = units.filter((unit) => unit.status === "pending" || unit.status === "failed").slice(0, limit);
  run.status = pending.length ? "running" : "completed";
  run.updatedAt = now();

  let checkpoint = Promise.resolve();
  const saveCheckpoint = () => {
    checkpoint = checkpoint.then(() => saveWorkUnits(runId, units));
    return checkpoint;
  };

  async function processUnit(unit: WorkUnit) {
    unit.status = "running";
    unit.attemptCount += 1;
    unit.updatedAt = now();
    await saveCheckpoint();

    try {
      if (unit.taskType === "rating") {
        const result = await runRatingTask(unit.modelKey, unit.messages);
        unit.rawOutput = result.rawOutput;
        unit.rawResponse = result.rawResponse;
        unit.parsedRating = result.parsedRating;
        unit.errorNote = result.errorNote;
        unit.status = result.errorNote ? "failed" : "succeeded";
      } else {
        const result = await runQualitativeTask(unit.modelKey, unit.messages);
        unit.rawOutput = result.rawOutput;
        unit.rawResponse = result.rawResponse;
        unit.errorNote = result.errorNote;
        unit.status = result.errorNote ? "failed" : "succeeded";
      }
    } catch (error) {
      unit.status = "failed";
      unit.errorNote = error instanceof Error ? error.message : String(error);
    }
    unit.updatedAt = now();
    await saveCheckpoint();
  }

  const workerCount = Math.max(1, Math.min(Math.floor(concurrency), pending.length || 1));
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < pending.length) {
        const unit = pending[nextIndex++];
        await processUnit(unit);
      }
    })
  );

  if (units.every((unit) => unit.status === "succeeded" || unit.status === "skipped")) {
    run.status = "completed";
  }

  await saveWorkUnits(runId, units);
  await upsertRun(run);
  return { run, processed: pending.length, remaining: units.filter((unit) => unit.status === "pending" || unit.status === "failed").length };
}
