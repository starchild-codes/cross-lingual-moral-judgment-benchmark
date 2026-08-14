import { computeAnalysis, type RatingRow } from "./analysis";
import { loadScenarioMetadata } from "./scenarios";
import { listRuns, loadWorkUnits } from "./storage";

export async function loadRunRatingRows(runId: string): Promise<RatingRow[]> {
  const [units, scenarios] = await Promise.all([loadWorkUnits(runId), loadScenarioMetadata()]);
  const scenarioById = new Map(scenarios.map((scenario) => [scenario.scenario_id, scenario]));

  return units
    .filter((unit) => unit.taskType === "rating" && unit.status === "succeeded")
    .map((unit) => ({
      modelKey: unit.modelKey,
      scenarioId: unit.scenarioId,
      conditionId: unit.conditionId,
      inputLang: unit.inputLang,
      reasoningLang: unit.reasoningLang,
      scenarioVersion: unit.scenarioVersion,
      mft_foundation: scenarioById.get(unit.scenarioId)?.mft_foundation,
      rating: unit.parsedRating
    }));
}

export async function latestCompletedFullAnalysis() {
  const runs = await listRuns();
  const run = runs.find((entry) => entry.mode === "full" && entry.status === "completed");
  if (!run) return null;
  const rows = await loadRunRatingRows(run.id);
  return { run, rows, analysis: computeAnalysis(rows) };
}
