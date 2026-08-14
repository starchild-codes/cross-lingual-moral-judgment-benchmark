import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  computeTrial2Statistics,
  mergeTrial2Responses,
  type Trial2AdminKeyRow,
  type Trial2MergedRow
} from "../lib/scenario-validation-trial2-stats";
import {
  isTrial2Foundation,
  trial2CoderIds,
  type Trial2CoderId,
  type Trial2Response
} from "../lib/scenario-validation-trial2-shared";

type CsvRow = Record<string, string>;

const outputDir = path.join(process.cwd(), "results", "processed", "scenario_validation_trial2");
const forbiddenCoderColumns = ["intended_mft_foundation", "mft_category", "model_key", "designed_foundation"];

async function main() {
  const paths: Record<Trial2CoderId, string> = {
    Coder_A: resolveArg("--coder-a", path.join(outputDir, "scenario_validation_Coder_A.csv")),
    Coder_B: resolveArg("--coder-b", path.join(outputDir, "scenario_validation_Coder_B.csv")),
    Coder_C: resolveArg("--coder-c", path.join(outputDir, "scenario_validation_Coder_C.csv"))
  };
  const adminPath = resolveArg("--admin-key", path.join(outputDir, "scenario_validation_admin_key.csv"));

  await mkdir(outputDir, { recursive: true });
  const responses: Trial2Response[] = [];
  for (const coderId of trial2CoderIds) {
    const rows = await readCsv(paths[coderId]);
    assertCoderSafeColumns(rows, coderId);
    const normalized = normalizeCoderRows(rows, coderId);
    responses.push(...normalized);
    await writeFile(path.join(outputDir, `scenario_validation_${coderId}.csv`), toCsv(normalized.map(exportCoderRow)), "utf8");
  }

  const adminRows = normalizeAdminRows(await readCsv(adminPath));
  const merged = mergeTrial2Responses(responses, adminRows);
  const stats = computeTrial2Statistics(merged);

  await writeFile(path.join(outputDir, "scenario_validation_merged_3coders.csv"), toCsv(merged.map(stringifyRecord)), "utf8");
  await writeFile(path.join(outputDir, "scenario_validation_summary_3coders.csv"), toCsv(summaryRows(stats)), "utf8");
  await writeFile(path.join(outputDir, "scenario_validation_by_foundation_3coders.csv"), toCsv(stats.by_foundation.map(stringifyRecord)), "utf8");
  await writeFile(path.join(outputDir, "authority_subversion_validation_detail_3coders.csv"), toCsv(authorityRows(merged)), "utf8");
  await writeFile(path.join(outputDir, "scenario_validation_disagreements_3coders.csv"), toCsv(disagreementRows(merged)), "utf8");
  await writeFile(path.join(outputDir, "scenario_validation_methods_3coders.md"), methodsReport(stats), "utf8");

  console.log("Trial 2 three-coder validation complete.");
  console.log(`Pairwise raw agreement: ${stats.pairwise.map((row) => `${row.pair}=${percent(row.raw_agreement)}`).join(", ")}`);
  console.log(`Pairwise Cohen's kappa: ${stats.pairwise.map((row) => `${row.pair}=${format(row.cohens_kappa)}`).join(", ")}`);
  console.log(`Fleiss' kappa: ${format(stats.fleiss_kappa)}`);
  console.log(`Majority agreement with intended labels: ${percent(stats.majority_vote_agreement_with_intended)}`);
  console.log(`Outputs: ${outputDir}`);
}

async function readCsv(file: string) {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true, trim: true }) as CsvRow[];
}

function normalizeCoderRows(rows: CsvRow[], coderId: Trial2CoderId): Trial2Response[] {
  if (rows.length !== 50) throw new Error(`${coderId} export has ${rows.length} rows; expected 50.`);
  return rows.map((row, index) => {
    if (row.coder_id && row.coder_id !== coderId) throw new Error(`Row ${index + 2} in ${coderId} export has coder_id=${row.coder_id}.`);
    if (!isTrial2Foundation(row.coder_scenario_label)) throw new Error(`${coderId} ${row.scenario_id} has an invalid or missing label.`);
    return {
      coder_id: coderId,
      scenario_id: row.scenario_id,
      shown_order: Number(row.shown_order),
      scenario_text_en: row.scenario_text_en,
      coder_scenario_label: row.coder_scenario_label,
      coder_notes: row.coder_notes ?? "",
      saved_at: row.timestamp || row.saved_at,
      submitted_at: row.submitted_at || null,
      is_submitted: parseBoolean(row.is_submitted)
    };
  });
}

function normalizeAdminRows(rows: CsvRow[]): Trial2AdminKeyRow[] {
  return rows.map((row) => {
    if (!isTrial2Foundation(row.intended_mft_foundation)) throw new Error(`Invalid intended foundation for ${row.scenario_id}.`);
    return {
      scenario_id: row.scenario_id,
      scenario_text_en: row.scenario_text_en,
      intended_mft_foundation: row.intended_mft_foundation
    };
  });
}

function assertCoderSafeColumns(rows: CsvRow[], coderId: Trial2CoderId) {
  const columns = Object.keys(rows[0] ?? {});
  const exposed = forbiddenCoderColumns.filter((column) => columns.includes(column));
  if (exposed.length) throw new Error(`${coderId} coder-facing export exposes forbidden columns: ${exposed.join(", ")}`);
}

function exportCoderRow(row: Trial2Response) {
  return stringifyRecord({
    coder_id: row.coder_id,
    scenario_id: row.scenario_id,
    shown_order: row.shown_order,
    scenario_text_en: row.scenario_text_en,
    coder_scenario_label: row.coder_scenario_label,
    coder_notes: row.coder_notes,
    timestamp: row.saved_at,
    is_submitted: row.is_submitted
  });
}

function summaryRows(stats: ReturnType<typeof computeTrial2Statistics>) {
  const rows: Array<Record<string, string>> = [
    { metric: "scenario_count", value: "50" },
    ...stats.pairwise.flatMap((row) => [
      { metric: `${row.pair}_raw_agreement`, value: format(row.raw_agreement) },
      { metric: `${row.pair}_cohens_kappa`, value: format(row.cohens_kappa) }
    ]),
    { metric: "mean_pairwise_raw_agreement", value: format(stats.mean_pairwise_raw_agreement) },
    { metric: "mean_pairwise_cohens_kappa", value: format(stats.mean_pairwise_cohens_kappa) },
    { metric: "fleiss_kappa", value: format(stats.fleiss_kappa) },
    ...trial2CoderIds.map((coderId) => ({ metric: `${coderId}_agreement_with_intended`, value: format(stats.coder_intended_agreement[coderId]) })),
    { metric: "majority_vote_agreement_with_intended", value: format(stats.majority_vote_agreement_with_intended) },
    { metric: "majority_mismatch_count", value: String(stats.majority_mismatch_count) },
    { metric: "all_three_disagree_count", value: String(stats.all_three_disagree_count) }
  ];
  return rows;
}

function authorityRows(rows: Trial2MergedRow[]) {
  return rows
    .filter((row) => row.intended_mft_foundation === "Authority/Subversion")
    .map((row) => stringifyRecord({
      scenario_id: row.scenario_id,
      scenario_text_en: row.scenario_text_en,
      intended_mft_foundation: row.intended_mft_foundation,
      Coder_A_label: row.Coder_A_label,
      Coder_B_label: row.Coder_B_label,
      Coder_C_label: row.Coder_C_label,
      majority_vote_label: row.majority_vote_label,
      majority_matches_intended: row.majority_matches_intended,
      num_coders_matching_intended: row.num_coders_matching_intended,
      Coder_A_notes: row.Coder_A_notes,
      Coder_B_notes: row.Coder_B_notes,
      Coder_C_notes: row.Coder_C_notes
    }));
}

function disagreementRows(rows: Trial2MergedRow[]) {
  return rows
    .filter((row) => new Set([row.Coder_A_label, row.Coder_B_label, row.Coder_C_label]).size > 1 || !row.majority_matches_intended)
    .map(stringifyRecord);
}

function methodsReport(stats: ReturnType<typeof computeTrial2Statistics>) {
  const authority = stats.by_foundation.find((row) => row.intended_mft_foundation === "Authority/Subversion");
  return `# Three-Coder Scenario Foundation Validation (Trial 2)\n\nThree independent human coders labelled all 50 English scenarios while blinded to the intended foundation labels, model outputs, and one another's labels. For each scenario, coders selected one primary Moral Foundations Theory category from Care/Harm, Fairness/Cheating, Loyalty/Betrayal, Authority/Subversion, and Sanctity/Degradation. Pairwise raw agreement was ${stats.pairwise.map((row) => `${row.pair.replaceAll("_", " ")} ${percent(row.raw_agreement)}`).join(", ")}. Pairwise Cohen's kappa was ${stats.pairwise.map((row) => `${row.pair.replaceAll("_", " ")} ${format(row.cohens_kappa)}`).join(", ")}, with a mean pairwise kappa of ${format(stats.mean_pairwise_cohens_kappa)}; Fleiss' kappa across all three coders was ${format(stats.fleiss_kappa)}. Majority-vote labels matched the intended foundation for ${percent(stats.majority_vote_agreement_with_intended)} of scenarios overall. Foundation-specific majority agreement is reported in \`scenario_validation_by_foundation_3coders.csv\`; for Authority/Subversion scenarios specifically, majority-vote agreement with the intended foundation was ${authority ? percent(authority.majority_vote_agreement_with_intended) : "not available"} (n = ${authority?.n ?? 0}).\n`;
}

function resolveArg(name: string, fallback: string) {
  const index = process.argv.indexOf(name);
  return path.resolve(index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback);
}

function parseBoolean(value: string | undefined) {
  return value === "true" || value === "1" || value === "TRUE";
}

function stringifyRecord(record: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value === null || value === undefined ? "" : String(value)]));
}

function toCsv(rows: Array<Record<string, string>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function format(value: number) {
  return value.toFixed(6);
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
