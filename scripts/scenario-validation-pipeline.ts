import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, string>;

type CoderRow = {
  coder_id: string;
  validation_mode: string;
  scenario_id: string;
  shown_order: string;
  scenario_text_en: string;
  coder_scenario_label: string;
  coder_notes: string;
  timestamp: string;
};

type AdminRow = {
  scenario_id: string;
  intended_mft_foundation: string;
  mft_category: string;
  scenario_text_en: string;
};

type MergedRow = {
  scenario_id: string;
  scenario_text_en: string;
  intended_mft_foundation: string;
  coder_a_scenario_label: string;
  coder_a_notes: string;
  coder_b_scenario_label: string;
  coder_b_notes: string;
  coder_a_matches_intended: string;
  coder_b_matches_intended: string;
  coders_agree: string;
  needs_adjudication: string;
};

const outDir = path.join(process.cwd(), "results", "processed", "scenario_validation");
const adminKeyPath = path.join(process.cwd(), "results", "processed", "scenario_validation_interface", "scenario_validation_admin_key.csv");
const coderAPath = path.join(outDir, "coder_A_scenario_validation_cleaned.csv");
const coderBPath = path.join(outDir, "coder_B_scenario_validation.csv");

const foundations = [
  "Care/Harm",
  "Fairness/Cheating",
  "Loyalty/Betrayal",
  "Authority/Subversion",
  "Sanctity/Degradation"
];

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const command = args[0];
  await mkdir(outDir, { recursive: true });

  if (command === "prepare-coder-a") {
    const input = getArg("--input") ?? process.argv[3];
    if (!input) throw new Error("Usage: corepack pnpm scenario-validation-pipeline -- prepare-coder-a --input path/to/coder_a_export.csv");
    await prepareCoderA(path.resolve(input));
    return;
  }

  if (command === "compute") {
    await computeValidation();
    return;
  }

  if (command === "adjudicated") {
    const input = getArg("--input") ?? process.argv[3];
    if (!input) throw new Error("Usage: corepack pnpm scenario-validation-pipeline -- adjudicated --input path/to/adjudicated.csv");
    await computeAdjudicated(path.resolve(input));
    return;
  }

  throw new Error("Usage: corepack pnpm scenario-validation-pipeline -- <prepare-coder-a|compute|adjudicated>");
}

async function prepareCoderA(inputPath: string) {
  const rows = (await readCsv<CoderRow>(inputPath)).map((row) => ({
    ...row,
    coder_id: "Coder_A"
  }));
  validateCoderFacingRows(rows, "Coder_A", false);
  await writeFile(coderAPath, toCsv(rows), "utf8");
  await writePlaceholderMethods();
  console.log(`Saved cleaned Coder A export: ${coderAPath}`);
  console.log(`Rows: ${rows.length}`);
  console.log("Coder B URL: http://localhost:3000/scenario-validation?coder=Coder_B");
}

async function computeValidation() {
  const [admin, coderA, coderB] = await Promise.all([
    readCsv<AdminRow>(adminKeyPath),
    readCsv<CoderRow>(coderAPath),
    readCsv<CoderRow>(coderBPath)
  ]);

  validateAdmin(admin);
  validateCoderFacingRows(coderA, "Coder_A", false);
  validateCoderFacingRows(coderB, "Coder_B", false);
  sanityCheckIds(admin, coderA, coderB);

  const merged = mergeRows(admin, coderA, coderB);
  const summary = summaryRows(merged);
  const byFoundation = byFoundationRows(merged);
  const authorityDetail = merged.filter((row) => row.intended_mft_foundation === "Authority/Subversion");
  const adjudication = merged
    .filter((row) => row.needs_adjudication === "true")
    .map((row) => ({
      scenario_id: row.scenario_id,
      scenario_text_en: row.scenario_text_en,
      intended_mft_foundation: row.intended_mft_foundation,
      coder_a_scenario_label: row.coder_a_scenario_label,
      coder_b_scenario_label: row.coder_b_scenario_label,
      coder_a_notes: row.coder_a_notes,
      coder_b_notes: row.coder_b_notes,
      adjudicated_label: "",
      adjudication_notes: ""
    }));

  await Promise.all([
    writeFile(path.join(outDir, "scenario_foundation_validation_merged.csv"), toCsv(merged), "utf8"),
    writeFile(path.join(outDir, "scenario_foundation_validation_summary.csv"), toCsv(summary), "utf8"),
    writeFile(path.join(outDir, "scenario_foundation_validation_by_foundation.csv"), toCsv(byFoundation), "utf8"),
    writeFile(path.join(outDir, "authority_subversion_validation_detail.csv"), toCsv(authorityDetail), "utf8"),
    writeFile(path.join(outDir, "coderA_vs_intended_confusion_matrix.csv"), confusionCsv(merged, "intended_mft_foundation", "coder_a_scenario_label"), "utf8"),
    writeFile(path.join(outDir, "coderB_vs_intended_confusion_matrix.csv"), confusionCsv(merged, "intended_mft_foundation", "coder_b_scenario_label"), "utf8"),
    writeFile(path.join(outDir, "coderA_vs_coderB_confusion_matrix.csv"), confusionCsv(merged, "coder_a_scenario_label", "coder_b_scenario_label"), "utf8"),
    writeFile(path.join(outDir, "scenario_foundation_adjudication_template.csv"), toCsv(adjudication), "utf8"),
    writeFile(path.join(outDir, "scenario_foundation_validation_methods.md"), methodsMarkdown(merged, summary, byFoundation, authorityDetail), "utf8")
  ]);

  console.log("Scenario-foundation validation complete.");
  for (const row of summary) console.log(`${row.metric}: ${row.value}${row.percent ? ` (${row.percent})` : ""}`);
  console.log(`Merged rows: ${merged.length}`);
  console.log(`Needs adjudication: ${adjudication.length}`);
  console.log(`Output folder: ${outDir}`);
}

async function computeAdjudicated(inputPath: string) {
  const rows = await readCsv<Row>(inputPath);
  const valid = rows.filter((row) => row.adjudicated_label?.trim());
  for (const row of valid) assertLabel(row.adjudicated_label, `adjudicated_label for ${row.scenario_id}`);
  const overall = proportion(valid, (row) => row.adjudicated_label === row.intended_mft_foundation);
  const byFoundation = foundations.map((foundation) => {
    const subset = valid.filter((row) => row.intended_mft_foundation === foundation);
    return {
      intended_mft_foundation: foundation,
      n: String(subset.length),
      adjudicated_intended_agreement: formatNumber(proportion(subset, (row) => row.adjudicated_label === row.intended_mft_foundation)),
      adjudicated_intended_agreement_percent: formatPercent(proportion(subset, (row) => row.adjudicated_label === row.intended_mft_foundation))
    };
  });
  const authority = byFoundation.find((row) => row.intended_mft_foundation === "Authority/Subversion");
  const summary = [
    metricRow("adjudicated_rows", valid.length),
    metricRow("adjudicated_intended_agreement", overall),
    metricRow("authority_subversion_adjudicated_intended_agreement", authority?.adjudicated_intended_agreement ? Number(authority.adjudicated_intended_agreement) : null)
  ];
  await Promise.all([
    writeFile(path.join(outDir, "scenario_foundation_adjudicated_summary.csv"), toCsv(summary), "utf8"),
    writeFile(path.join(outDir, "scenario_foundation_adjudicated_by_foundation.csv"), toCsv(byFoundation), "utf8")
  ]);
  console.log(`Computed adjudicated validation outputs in ${outDir}`);
}

function mergeRows(admin: AdminRow[], coderA: CoderRow[], coderB: CoderRow[]): MergedRow[] {
  const aById = new Map(coderA.map((row) => [row.scenario_id, row]));
  const bById = new Map(coderB.map((row) => [row.scenario_id, row]));
  return admin
    .slice()
    .sort((a, b) => a.scenario_id.localeCompare(b.scenario_id, undefined, { numeric: true }))
    .map((adminRow) => {
      const a = requireRow(aById, adminRow.scenario_id, "Coder A");
      const b = requireRow(bById, adminRow.scenario_id, "Coder B");
      const aMatch = a.coder_scenario_label === adminRow.intended_mft_foundation;
      const bMatch = b.coder_scenario_label === adminRow.intended_mft_foundation;
      const agree = a.coder_scenario_label === b.coder_scenario_label;
      return {
        scenario_id: adminRow.scenario_id,
        scenario_text_en: adminRow.scenario_text_en,
        intended_mft_foundation: adminRow.intended_mft_foundation,
        coder_a_scenario_label: a.coder_scenario_label,
        coder_a_notes: a.coder_notes ?? "",
        coder_b_scenario_label: b.coder_scenario_label,
        coder_b_notes: b.coder_notes ?? "",
        coder_a_matches_intended: String(aMatch),
        coder_b_matches_intended: String(bMatch),
        coders_agree: String(agree),
        needs_adjudication: String(!agree)
      };
    });
}

function summaryRows(rows: MergedRow[]) {
  const rawAgreement = proportion(rows, (row) => row.coders_agree === "true");
  const kappa = cohenKappa(rows.map((row) => [row.coder_a_scenario_label, row.coder_b_scenario_label]));
  const aIntended = proportion(rows, (row) => row.coder_a_matches_intended === "true");
  const bIntended = proportion(rows, (row) => row.coder_b_matches_intended === "true");
  const both = proportion(rows, (row) => row.coder_a_matches_intended === "true" && row.coder_b_matches_intended === "true");
  const atLeastOne = proportion(rows, (row) => row.coder_a_matches_intended === "true" || row.coder_b_matches_intended === "true");
  return [
    metricRow("scenario_rows", rows.length),
    metricRow("coder_a_b_raw_agreement", rawAgreement),
    metricRow("coder_a_b_cohens_kappa", kappa),
    metricRow("coder_a_intended_agreement", aIntended),
    metricRow("coder_b_intended_agreement", bIntended),
    metricRow("average_coder_intended_agreement", average([aIntended, bIntended])),
    metricRow("both_coders_match_intended_rate", both),
    metricRow("at_least_one_coder_matches_intended_rate", atLeastOne),
    metricRow("needs_adjudication_rows", rows.filter((row) => row.needs_adjudication === "true").length)
  ];
}

function byFoundationRows(rows: MergedRow[]) {
  return foundations.map((foundation) => {
    const subset = rows.filter((row) => row.intended_mft_foundation === foundation);
    const a = proportion(subset, (row) => row.coder_a_matches_intended === "true");
    const b = proportion(subset, (row) => row.coder_b_matches_intended === "true");
    return {
      intended_mft_foundation: foundation,
      n: String(subset.length),
      coder_a_intended_agreement: formatNumber(a),
      coder_a_intended_agreement_percent: formatPercent(a),
      coder_b_intended_agreement: formatNumber(b),
      coder_b_intended_agreement_percent: formatPercent(b),
      average_coder_intended_agreement: formatNumber(average([a, b])),
      average_coder_intended_agreement_percent: formatPercent(average([a, b])),
      both_coders_match_intended_rate: formatNumber(proportion(subset, (row) => row.coder_a_matches_intended === "true" && row.coder_b_matches_intended === "true")),
      at_least_one_coder_matches_intended_rate: formatNumber(proportion(subset, (row) => row.coder_a_matches_intended === "true" || row.coder_b_matches_intended === "true")),
      coder_a_b_raw_agreement: formatNumber(proportion(subset, (row) => row.coders_agree === "true")),
      coder_a_b_raw_agreement_percent: formatPercent(proportion(subset, (row) => row.coders_agree === "true"))
    };
  });
}

function methodsMarkdown(rows: MergedRow[], summary: Array<Record<string, string>>, byFoundation: Array<Record<string, string>>, authority: MergedRow[]) {
  const get = (metric: string) => summary.find((row) => row.metric === metric);
  const authorityStats = byFoundation.find((row) => row.intended_mft_foundation === "Authority/Subversion");
  const disagreements = rows.filter((row) => row.needs_adjudication === "true").length;
  return `# Scenario Foundation Validation Methods

Two independent human coders labelled all 50 English scenarios in a blinded scenario-validation interface. Coders were shown only the scenario ID, English scenario text, five Moral Foundations Theory response options, and an optional notes box; they were not shown intended foundation labels, Coder A labels, model outputs, language condition, or translation/adaptation status. Coders selected the primary MFT category from: Care/Harm, Fairness/Cheating, Loyalty/Betrayal, Authority/Subversion, and Sanctity/Degradation.

Raw Coder A vs Coder B agreement was ${get("coder_a_b_raw_agreement")?.percent} (Cohen's kappa = ${get("coder_a_b_cohens_kappa")?.value}). Coder A matched the intended scenario foundation for ${get("coder_a_intended_agreement")?.percent} of scenarios, and Coder B matched the intended foundation for ${get("coder_b_intended_agreement")?.percent}; the average coder-intended agreement was ${get("average_coder_intended_agreement")?.percent}. Both coders matched the intended foundation for ${get("both_coders_match_intended_rate")?.percent} of scenarios, while at least one coder matched the intended foundation for ${get("at_least_one_coder_matches_intended_rate")?.percent}. For intended Authority/Subversion scenarios specifically (n = ${authority.length}), Coder A agreement was ${authorityStats?.coder_a_intended_agreement_percent}, Coder B agreement was ${authorityStats?.coder_b_intended_agreement_percent}, average coder-intended agreement was ${authorityStats?.average_coder_intended_agreement_percent}, both-coder match rate was ${formatPercent(proportion(authority, (row) => row.coder_a_matches_intended === "true" && row.coder_b_matches_intended === "true"))}, and at-least-one-coder match rate was ${formatPercent(proportion(authority, (row) => row.coder_a_matches_intended === "true" || row.coder_b_matches_intended === "true"))}. ${disagreements > 0 ? `${disagreements} coder disagreements require adjudication before an adjudicated scenario-label validation statistic can be reported.` : "No coder disagreements required adjudication."}

## Summary

${markdownTable(summary)}

## By Foundation

${markdownTable(byFoundation)}
`;
}

async function writePlaceholderMethods() {
  const text = `# Scenario Foundation Validation Methods

Coder A has been cleaned and saved. Coder B has not completed validation yet, so agreement and intended-foundation validation statistics are pending.

Coder B should use the blinded full validation interface:

http://localhost:3000/scenario-validation?coder=Coder_B

After Coder B saves/exports \`coder_B_scenario_validation.csv\`, run:

\`\`\`powershell
corepack pnpm scenario-validation-pipeline -- compute
\`\`\`
`;
  await writeFile(path.join(outDir, "scenario_foundation_validation_methods.md"), text, "utf8");
}

function validateAdmin(rows: AdminRow[]) {
  if (rows.length !== 50) throw new Error(`Admin key must contain 50 rows; found ${rows.length}.`);
  for (const row of rows) {
    assertLabel(row.intended_mft_foundation, `intended_mft_foundation for ${row.scenario_id}`);
    if (!row.scenario_text_en) throw new Error(`Admin key missing scenario_text_en for ${row.scenario_id}.`);
  }
}

function validateCoderFacingRows(rows: CoderRow[], expectedCoderId: string, allowIntendedColumns: boolean) {
  if (rows.length !== 50) throw new Error(`${expectedCoderId} file must contain 50 rows; found ${rows.length}.`);
  const ids = new Set(rows.map((row) => row.scenario_id));
  if (ids.size !== 50) throw new Error(`${expectedCoderId} file must contain 50 unique scenario_ids; found ${ids.size}.`);
  for (const row of rows) {
    if (row.coder_id !== expectedCoderId) throw new Error(`${expectedCoderId} file has unexpected coder_id '${row.coder_id}' for ${row.scenario_id}.`);
    if (!row.coder_scenario_label) throw new Error(`${expectedCoderId} file missing coder_scenario_label for ${row.scenario_id}.`);
    assertLabel(row.coder_scenario_label, `${expectedCoderId} label for ${row.scenario_id}`);
  }
  if (!allowIntendedColumns) {
    const forbidden = ["intended_mft_foundation", "mft_category", "coder_a_scenario_label", "model_key", "condition_id", "scenarioVersion", "scenario_version"];
    const present = forbidden.filter((column) => Object.prototype.hasOwnProperty.call(rows[0] ?? {}, column));
    if (present.length) throw new Error(`${expectedCoderId} coder-facing file contains forbidden column(s): ${present.join(", ")}`);
  }
}

function sanityCheckIds(admin: AdminRow[], coderA: CoderRow[], coderB: CoderRow[]) {
  const adminIds = sortedIds(admin);
  const aIds = sortedIds(coderA);
  const bIds = sortedIds(coderB);
  if (adminIds.join("|") !== aIds.join("|")) throw new Error("Coder A scenario_ids do not match the admin key exactly.");
  if (adminIds.join("|") !== bIds.join("|")) throw new Error("Coder B scenario_ids do not match the admin key exactly.");
}

function confusionCsv(rows: MergedRow[], rowKey: keyof MergedRow, columnKey: keyof MergedRow) {
  const matrix = foundations.map((rowLabel) => {
    const out: Record<string, string> = { label: rowLabel };
    for (const columnLabel of foundations) {
      out[columnLabel] = String(rows.filter((row) => row[rowKey] === rowLabel && row[columnKey] === columnLabel).length);
    }
    return out;
  });
  return toCsv(matrix);
}

function cohenKappa(pairs: Array<[string, string]>) {
  const labels = foundations;
  const total = pairs.length;
  const observed = pairs.filter(([a, b]) => a === b).length / total;
  const expected = labels.reduce((sum, label) => {
    const aShare = pairs.filter(([a]) => a === label).length / total;
    const bShare = pairs.filter(([, b]) => b === label).length / total;
    return sum + aShare * bShare;
  }, 0);
  return expected === 1 ? (observed === 1 ? 1 : null) : (observed - expected) / (1 - expected);
}

async function readCsv<T extends Row>(file: string): Promise<T[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true, trim: true }) as T[];
}

function toCsv(rows: Array<Record<string, string>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function markdownTable(rows: Array<Record<string, string>>) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => row[header].replace(/\|/g, "\\|")).join(" | ")} |`)
  ].join("\n");
}

function metricRow(metric: string, value: number | null) {
  const percent = metric.includes("agreement") || metric.includes("rate");
  return {
    metric,
    value: formatNumber(value),
    percent: percent ? formatPercent(value) : ""
  };
}

function proportion<T>(rows: T[], predicate: (row: T) => boolean) {
  if (!rows.length) return null;
  return rows.filter(predicate).length / rows.length;
}

function average(values: Array<number | null>) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toPrecision(6).replace(/\.?0+$/, "");
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "";
  return `${(value * 100).toFixed(2)}%`;
}

function assertLabel(label: string | undefined, context: string) {
  if (!label || !foundations.includes(label)) throw new Error(`Invalid ${context}: '${label ?? ""}'.`);
}

function requireRow<T>(map: Map<string, T>, id: string, label: string) {
  const row = map.get(id);
  if (!row) throw new Error(`${label} file is missing ${id}.`);
  return row;
}

function sortedIds(rows: Array<{ scenario_id: string }>) {
  return rows.map((row) => row.scenario_id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
