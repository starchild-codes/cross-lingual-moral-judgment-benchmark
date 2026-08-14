import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import path from "node:path";

type AdminRow = {
  scenario_id: string;
  scenario_text_en: string;
  intended_mft_foundation: string;
};

async function main() {
  config({ path: path.join(process.cwd(), ".env.local") });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");

  const file = path.join(process.cwd(), "results", "processed", "scenario_validation_trial2", "scenario_validation_admin_key.csv");
  const rows = parse(await readFile(file, "utf8"), {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true
  }) as AdminRow[];
  if (rows.length !== 50) throw new Error(`Expected 50 admin-key rows; found ${rows.length}.`);

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.from("scenario_validation_scenarios").upsert(rows, { onConflict: "scenario_id" });
  if (error) throw new Error(error.message);
  console.log(`Seeded ${rows.length} Trial 2 scenarios into Supabase.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
