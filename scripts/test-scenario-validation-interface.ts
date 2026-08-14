import { readFile } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse/sync";

type CoderItem = {
  scenario_id: string;
  scenario_text_en: string;
};

type AdminRow = {
  scenario_id: string;
  intended_mft_foundation: string;
  mft_category: string;
  scenario_text_en: string;
};

const outputDir = path.join(process.cwd(), "results", "processed", "scenario_validation_interface");

async function main() {
  const [full, authority, admin] = await Promise.all([
    readJson<CoderItem[]>(path.join(outputDir, "scenario_validation_items.full.json")),
    readJson<CoderItem[]>(path.join(outputDir, "scenario_validation_items.authority_only.json")),
    readCsv<AdminRow>(path.join(outputDir, "scenario_validation_admin_key.csv"))
  ]);

  const authorityExpected = admin.filter((row) => row.intended_mft_foundation === "Authority/Subversion");
  assert(full.length === 50, `Expected 50 full-mode scenarios, found ${full.length}.`);
  assert(authority.length === authorityExpected.length, `Expected ${authorityExpected.length} authority scenarios, found ${authority.length}.`);
  assert(new Set(full.map((row) => row.scenario_id)).size === full.length, "Full-mode scenario IDs are not unique.");
  assert(new Set(authority.map((row) => row.scenario_id)).size === authority.length, "Authority-mode scenario IDs are not unique.");
  assert(full.every((row) => row.scenario_id && row.scenario_text_en), "Full-mode rows must include scenario_id and scenario_text_en.");
  assert(authority.every((row) => row.scenario_id && row.scenario_text_en), "Authority-mode rows must include scenario_id and scenario_text_en.");

  const authorityIds = new Set(authority.map((row) => row.scenario_id));
  const expectedIds = new Set(authorityExpected.map((row) => row.scenario_id));
  for (const id of expectedIds) assert(authorityIds.has(id), `Authority-mode data is missing ${id}.`);
  for (const id of authorityIds) assert(expectedIds.has(id), `Authority-mode data includes non-authority scenario ${id}.`);

  console.log("Scenario validation interface data test passed.");
  console.log(`Full blinded mode scenarios: ${full.length}`);
  console.log(`Authority-only mode scenarios: ${authority.length}`);
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function readCsv<T>(file: string): Promise<T[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as T[];
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
