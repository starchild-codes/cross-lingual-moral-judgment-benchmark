import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, string>;

type NormalizedRow = {
  scenario_id: string;
  intended_mft_foundation: string;
  coder_a_scenario_label: string;
  coder_b_scenario_label: string;
  adjudicated_label?: string;
};

const root = process.cwd();
const outputDir = path.join(root, "results", "processed", "scenario_validation");

const allowedFoundations = [
  "Care/Harm",
  "Loyalty/Betrayal",
  "Authority/Subversion",
  "Fairness/Cheating",
  "Sanctity/Degradation"
];

async function main() {
  const input = getArg("--input") ?? process.argv[2];
  if (!input) {
    console.error("Usage: corepack pnpm scenario-foundation-validation -- --input path/to/scenario_validation.csv");
    process.exit(1);
  }

  await mkdir(outputDir, { recursive: true });

  const rows = normalizeRows(await readCsv(path.resolve(input)));
  const summaryRows = buildSummaryRows(rows);
  const byFoundationRows = buildByFoundationRows(rows);
  const paragraph = methodsParagraph(rows);

  await writeFile(path.join(outputDir, "scenario_foundation_validation_summary.csv"), toCsv(summaryRows), "utf8");
  await writeFile(path.join(outputDir, "scenario_foundation_validation_by_foundation.csv"), toCsv(byFoundationRows), "utf8");
  await writeFile(
    path.join(outputDir, "scenario_foundation_validation_methods.md"),
    markdownReport(rows, summaryRows, byFoundationRows, paragraph),
    "utf8"
  );

  console.log(`Validated ${rows.length} scenario rows.`);
  console.log(`Wrote summary outputs to ${outputDir}`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true, trim: true }) as Row[];
}

function normalizeRows(rows: Row[]): NormalizedRow[] {
  const required = ["scenario_id", "intended_mft_foundation", "coder_a_scenario_label", "coder_b_scenario_label"];
  const missing = required.filter((column) => !rows[0] || !(column in rows[0]));
  if (missing.length) {
    throw new Error(`Input CSV is missing required column(s): ${missing.join(", ")}`);
  }

  return rows.map((row, index) => {
    const normalized: NormalizedRow = {
      scenario_id: row.scenario_id,
      intended_mft_foundation: cleanLabel(row.intended_mft_foundation),
      coder_a_scenario_label: cleanLabel(row.coder_a_scenario_label),
      coder_b_scenario_label: cleanLabel(row.coder_b_scenario_label),
      adjudicated_label: row.adjudicated_label ? cleanLabel(row.adjudicated_label) : undefined
    };

    for (const [key, value] of Object.entries(normalized)) {
      if (key === "adjudicated_label" && !value) continue;
      if (!value) throw new Error(`Row ${index + 2} has an empty ${key}.`);
    }

    return normalized;
  });
}

function cleanLabel(label: string | undefined) {
  return (label ?? "").trim();
}

function buildSummaryRows(rows: NormalizedRow[]) {
  const coderKappa = cohenKappa(rows.map((row) => [row.coder_a_scenario_label, row.coder_b_scenario_label]));
  const adjudicatedAvailable = rows.some((row) => Boolean(row.adjudicated_label));
  const finalRows = rows
    .map((row) => ({ ...row, final_label: finalLabel(row) }))
    .filter((row) => Boolean(row.final_label));

  return [
    metricRow("scenario_rows", rows.length, "Total scenario validation rows in the input file."),
    metricRow("coder_a_b_raw_agreement", proportion(rows, (row) => row.coder_a_scenario_label === row.coder_b_scenario_label), "Coder A and Coder B exact label agreement."),
    metricRow("coder_a_b_cohens_kappa", coderKappa, "Cohen's kappa for Coder A vs Coder B labels."),
    metricRow("coder_a_intended_agreement", proportion(rows, (row) => row.coder_a_scenario_label === row.intended_mft_foundation), "Coder A agreement with intended foundation."),
    metricRow("coder_b_intended_agreement", proportion(rows, (row) => row.coder_b_scenario_label === row.intended_mft_foundation), "Coder B agreement with intended foundation."),
    metricRow(
      adjudicatedAvailable ? "adjudicated_intended_agreement" : "majority_resolved_intended_agreement",
      finalRows.length ? proportion(finalRows, (row) => row.final_label === row.intended_mft_foundation) : null,
      adjudicatedAvailable
        ? "Agreement between adjudicated labels and intended foundation."
        : "Agreement with intended foundation among rows where both coders agreed; disagreements are unresolved without adjudication."
    ),
    metricRow("majority_or_adjudicated_resolved_rows", finalRows.length, "Rows with an adjudicated label or coder agreement usable as a final label."),
    metricRow("unresolved_disagreement_rows", rows.length - finalRows.length, "Rows without adjudication where Coder A and Coder B disagreed.")
  ];
}

function buildByFoundationRows(rows: NormalizedRow[]) {
  return allowedFoundations.map((foundation) => {
    const subset = rows.filter((row) => row.intended_mft_foundation === foundation);
    const finalRows = subset
      .map((row) => ({ ...row, final_label: finalLabel(row) }))
      .filter((row) => Boolean(row.final_label));

    return {
      intended_mft_foundation: foundation,
      n: String(subset.length),
      coder_a_b_raw_agreement: formatNumber(proportion(subset, (row) => row.coder_a_scenario_label === row.coder_b_scenario_label)),
      coder_a_intended_agreement: formatNumber(proportion(subset, (row) => row.coder_a_scenario_label === row.intended_mft_foundation)),
      coder_b_intended_agreement: formatNumber(proportion(subset, (row) => row.coder_b_scenario_label === row.intended_mft_foundation)),
      final_intended_agreement: formatNumber(finalRows.length ? proportion(finalRows, (row) => row.final_label === row.intended_mft_foundation) : null),
      final_resolved_n: String(finalRows.length),
      unresolved_disagreement_n: String(subset.length - finalRows.length)
    };
  });
}

function finalLabel(row: NormalizedRow) {
  if (row.adjudicated_label) return row.adjudicated_label;
  if (row.coder_a_scenario_label === row.coder_b_scenario_label) return row.coder_a_scenario_label;
  return "";
}

function proportion<T>(rows: T[], predicate: (row: T) => boolean) {
  if (!rows.length) return null;
  return rows.filter(predicate).length / rows.length;
}

function cohenKappa(pairs: Array<[string, string]>) {
  if (!pairs.length) return null;
  const labels = Array.from(new Set(pairs.flat())).sort();
  const total = pairs.length;
  const observed = pairs.filter(([a, b]) => a === b).length / total;
  const expected = labels.reduce((sum, label) => {
    const aShare = pairs.filter(([a]) => a === label).length / total;
    const bShare = pairs.filter(([, b]) => b === label).length / total;
    return sum + aShare * bShare;
  }, 0);

  if (expected === 1) return observed === 1 ? 1 : null;
  return (observed - expected) / (1 - expected);
}

function metricRow(metric: string, value: number | null, note: string) {
  const percentMetrics = metric.includes("agreement");
  return {
    metric,
    value: formatNumber(value),
    percent: percentMetrics ? formatPercent(value) : "",
    note
  };
}

function methodsParagraph(rows: NormalizedRow[]) {
  const summary = buildSummaryRows(rows);
  const get = (metric: string) => summary.find((row) => row.metric === metric);
  const authority = buildByFoundationRows(rows).find((row) => row.intended_mft_foundation === "Authority/Subversion");
  const finalMetric = get("adjudicated_intended_agreement") ?? get("majority_resolved_intended_agreement");

  return `Scenario-level MFT validation was assessed by comparing two independent coder labels against each other and against the intended scenario foundation. Across ${rows.length} scenarios, raw coder agreement was ${get("coder_a_b_raw_agreement")?.percent} (Cohen's kappa = ${get("coder_a_b_cohens_kappa")?.value}). Coder A matched the intended foundation for ${get("coder_a_intended_agreement")?.percent} of scenarios, while Coder B matched it for ${get("coder_b_intended_agreement")?.percent}. ${finalMetric?.metric === "adjudicated_intended_agreement" ? "After adjudication" : "Among coder-agreement rows usable as a majority label"}, agreement with the intended foundation was ${finalMetric?.percent}. For Authority/Subversion scenarios specifically, final agreement with the intended foundation was ${authority?.final_intended_agreement ? formatPercent(Number(authority.final_intended_agreement)) : "not available"} (n = ${authority?.n ?? "0"}).`;
}

function markdownReport(rows: NormalizedRow[], summaryRows: Array<Record<string, string>>, byFoundationRows: Array<Record<string, string>>, paragraph: string) {
  return `# Scenario Foundation Validation

Input rows: ${rows.length}

## Summary

${markdownTable(summaryRows)}

## Agreement With Intended Foundation By MFT Foundation

${markdownTable(byFoundationRows)}

## Methods/Validation Paragraph

${paragraph}
`;
}

function getArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
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
    ...rows.map((row) => `| ${headers.map((header) => escapeMarkdown(row[header])).join(" | ")} |`)
  ].join("\n");
}

function escapeMarkdown(value: string) {
  return value.replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");
}

function formatNumber(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : value.toPrecision(6).replace(/\.?0+$/, "");
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "";
  return `${(value * 100).toFixed(2)}%`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
