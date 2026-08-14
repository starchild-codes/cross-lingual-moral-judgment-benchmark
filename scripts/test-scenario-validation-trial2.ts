import { parse } from "csv-parse/sync";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { computeTrial2Statistics, mergeTrial2Responses, type Trial2AdminKeyRow } from "../lib/scenario-validation-trial2-stats";
import { orderedScenariosForCoder, trial2CoderIds, type Trial2Response, type Trial2Scenario } from "../lib/scenario-validation-trial2-shared";

const root = process.cwd();
const outputDir = path.join(root, "results", "processed", "scenario_validation_trial2");
const deploymentDataDir = path.join(root, "data", "scenario_validation_trial2");

async function main() {
  const safeItems = JSON.parse(await readFile(path.join(deploymentDataDir, "scenario_validation_items.json"), "utf8")) as Trial2Scenario[];
  const adminRows = parse(await readFile(path.join(outputDir, "scenario_validation_admin_key.csv"), "utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true
  }) as Trial2AdminKeyRow[];

  assert(safeItems.length === 50, `Coder-safe item count is ${safeItems.length}, expected 50.`);
  assert(adminRows.length === 50, `Admin-key row count is ${adminRows.length}, expected 50.`);
  assert(new Set(safeItems.map((row) => row.scenario_id)).size === 50, "Coder-safe scenario IDs are not unique.");
  assert(!Object.keys(safeItems[0] ?? {}).includes("intended_mft_foundation"), "Coder-safe JSON exposes intended foundations.");

  const orders = trial2CoderIds.map((coderId) => orderedScenariosForCoder(safeItems, coderId));
  for (const [index, order] of orders.entries()) {
    assert(order.length === 50, `${trial2CoderIds[index]} does not receive 50 scenarios.`);
    assert(new Set(order.map((row) => row.scenario_id)).size === 50, `${trial2CoderIds[index]} has duplicate scenarios.`);
    assert(order.every((row, rowIndex) => row.shown_order === rowIndex + 1), `${trial2CoderIds[index]} shown order is invalid.`);
  }
  assert(new Set(orders.map((order) => order.map((row) => row.scenario_id).join("|"))).size === 3, "Coder randomization orders are not distinct.");

  const synthetic: Trial2Response[] = trial2CoderIds.flatMap((coderId, coderIndex) => orders[coderIndex].map((item) => {
    const intended = adminRows.find((row) => row.scenario_id === item.scenario_id)?.intended_mft_foundation;
    if (!intended) throw new Error(`Missing intended foundation for ${item.scenario_id}.`);
    return {
      coder_id: coderId,
      scenario_id: item.scenario_id,
      shown_order: item.shown_order,
      scenario_text_en: item.scenario_text_en,
      coder_scenario_label: intended,
      coder_notes: "",
      saved_at: "2026-01-01T00:00:00.000Z",
      submitted_at: "2026-01-01T00:00:00.000Z",
      is_submitted: true
    };
  }));
  const stats = computeTrial2Statistics(mergeTrial2Responses(synthetic, adminRows));
  assert(stats.pairwise.every((row) => row.raw_agreement === 1 && row.cohens_kappa === 1), "Pairwise agreement self-test failed.");
  assert(stats.fleiss_kappa === 1, "Fleiss' kappa self-test failed.");
  assert(stats.majority_vote_agreement_with_intended === 1, "Majority-vote self-test failed.");

  const coderComponent = await readFile(path.join(root, "components", "HostedScenarioValidationPanel.tsx"), "utf8");
  const coderPage = await readFile(path.join(root, "app", "validate", "[coderId]", "page.tsx"), "utf8");
  assert(!coderComponent.includes("intended_mft_foundation"), "Coder component contains intended-foundation metadata.");
  assert(!coderPage.includes("intended_mft_foundation"), "Coder page contains intended-foundation metadata.");

  const sql = await readFile(path.join(root, "supabase", "scenario-validation-trial2.sql"), "utf8");
  assert(sql.includes("unique (coder_id, scenario_id)"), "Supabase schema lacks coder/scenario uniqueness constraint.");
  assert(sql.includes("enable row level security"), "Supabase schema does not enable row-level security.");

  console.log("Trial 2 interface tests passed.");
  console.log("- 50 blinded scenarios for each of three coders");
  console.log("- deterministic, distinct coder orders");
  console.log("- intended foundations absent from coder UI/data");
  console.log("- pairwise kappa, Fleiss' kappa, and majority-vote engine verified");
  console.log("- backend uniqueness and RLS safeguards present");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
