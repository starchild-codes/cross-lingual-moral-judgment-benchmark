import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadScenarioMetadata } from "../lib/scenarios";

type AdminRow = {
  scenario_id: string;
  scenario_text_en: string;
  intended_mft_foundation: string;
};

const outputDir = path.join(process.cwd(), "results", "processed", "scenario_validation_trial2");
const deploymentDataDir = path.join(process.cwd(), "data", "scenario_validation_trial2");

const foundationMap: Record<string, string> = {
  "Care/Harm": "Care/Harm",
  "Loyalty/Betrayal": "Loyalty/Betrayal",
  "Authority/Subversion": "Authority/Subversion",
  "Fairness/Cheating": "Fairness/Cheating",
  "Sanctity/Degradation": "Sanctity/Degradation",
  "Loyalty/Fairness": "Loyalty/Betrayal",
  "Authority/Loyalty": "Authority/Subversion",
  "Fairness/Care": "Fairness/Cheating",
  Sanctity: "Sanctity/Degradation"
};

async function main() {
  const scenarios = await loadScenarioMetadata();
  const rows: AdminRow[] = scenarios
    .map((scenario) => ({
      scenario_id: scenario.scenario_id,
      scenario_text_en: scenario.text_en,
      intended_mft_foundation: normalizeFoundation(scenario.mft_foundation)
    }))
    .sort((a, b) => a.scenario_id.localeCompare(b.scenario_id, undefined, { numeric: true }));

  if (rows.length !== 50) throw new Error(`Trial 2 requires exactly 50 scenarios; found ${rows.length}.`);
  if (new Set(rows.map((row) => row.scenario_id)).size !== 50) throw new Error("Scenario IDs are not unique.");
  if (rows.some((row) => !row.scenario_text_en.trim())) throw new Error("One or more English scenario texts are empty.");

  await Promise.all([mkdir(outputDir, { recursive: true }), mkdir(deploymentDataDir, { recursive: true })]);
  const coderSafeRows = rows.map(({ scenario_id, scenario_text_en }) => ({ scenario_id, scenario_text_en }));
  await writeFile(
    path.join(outputDir, "scenario_validation_items.json"),
    JSON.stringify(coderSafeRows, null, 2),
    "utf8"
  );
  await writeFile(path.join(outputDir, "scenario_validation_admin_key.csv"), toCsv(rows), "utf8");
  await writeFile(path.join(outputDir, "scenario_validation_admin_key.json"), JSON.stringify(rows, null, 2), "utf8");
  await writeFile(path.join(deploymentDataDir, "scenario_validation_items.json"), JSON.stringify(coderSafeRows, null, 2), "utf8");
  await writeFile(path.join(deploymentDataDir, "scenario_validation_admin_key.json"), JSON.stringify(rows, null, 2), "utf8");
  await writeFile(
    path.join(outputDir, "scenario_validation_methods_3coders.md"),
    placeholderMethods(),
    "utf8"
  );

  console.log(`Trial 2 extraction complete: ${rows.length} English scenarios.`);
  console.log(`Admin key: ${path.join(outputDir, "scenario_validation_admin_key.csv")}`);
  console.log(`Deployment data: ${deploymentDataDir}`);
  console.log("Coder-safe data contains no intended foundation column.");
}

function normalizeFoundation(value: string) {
  const normalized = foundationMap[value];
  if (!normalized) throw new Error(`Unsupported MFT foundation: ${value}`);
  return normalized;
}

function toCsv(rows: AdminRow[]) {
  const headers: Array<keyof AdminRow> = ["scenario_id", "scenario_text_en", "intended_mft_foundation"];
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function placeholderMethods() {
  return `# Three-Coder Scenario Foundation Validation (Trial 2)\n\nThree independent human coders will label all 50 English scenarios while blinded to intended foundation labels, model outputs, and one another's responses. Each coder will select one primary Moral Foundations Theory category from five options. Pairwise raw agreement, pairwise Cohen's kappa, mean pairwise Cohen's kappa, Fleiss' kappa, majority-vote agreement with intended labels, foundation-specific validation, and Authority/Subversion validation will be inserted here after all three coders submit complete responses.\n`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
