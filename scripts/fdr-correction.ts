import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, string>;
type CorrectedRow = Row & {
  q_value_bh: string;
  fdr_significant_05: string;
  fdr_significant_10: string;
};
type FamilyRow = CorrectedRow & { family: string };

const root = process.cwd();
const analysisDir = path.join(root, "results", "processed", "analysis");
const fdrDir = path.join(root, "results", "processed", "fdr");
const paperDir = path.join(root, "paper_materials");

const primaryFamilies = [
  { name: "language_effect", input: "language_effects.csv", output: "language_effect_fdr.csv" },
  { name: "framing_effect", input: "framing_effects.csv", output: "framing_effect_fdr.csv" },
  { name: "reasoning_effect", input: "reasoning_effects.csv", output: "reasoning_effect_fdr.csv" },
  { name: "foundation_breakdown", input: "foundation_breakdown.csv", output: "foundation_breakdown_fdr.csv" }
] as const;

async function main() {
  await mkdir(fdrDir, { recursive: true });
  await mkdir(paperDir, { recursive: true });

  const correctedByFamily: Record<string, CorrectedRow[]> = {};
  for (const family of primaryFamilies) {
    const rows = await readCsv(path.join(analysisDir, family.input));
    const corrected = addBenjaminiHochberg(rows);
    correctedByFamily[family.name] = corrected;
    await writeFile(path.join(fdrDir, family.output), toCsv(corrected), "utf8");
  }

  await writeFile(path.join(fdrDir, "fdr_summary.md"), fdrSummary(correctedByFamily), "utf8");
  await writeFile(path.join(paperDir, "02_headline_findings_fdr.md"), headlineFindingsFdr(correctedByFamily), "utf8");

  console.log(`Wrote FDR-corrected CSVs and summary to ${fdrDir}`);
  console.log(`Wrote updated FDR-aware headline findings to ${path.join(paperDir, "02_headline_findings_fdr.md")}`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
}

function addBenjaminiHochberg(rows: Row[]): CorrectedRow[] {
  const output: CorrectedRow[] = rows.map((row) => ({ ...row, q_value_bh: "", fdr_significant_05: "", fdr_significant_10: "" }));
  const tests = output
    .map((row, index) => ({ row, index, p: Number(row.p_value) }))
    .filter((entry) => Number.isFinite(entry.p) && entry.p >= 0 && entry.p <= 1)
    .sort((a, b) => a.p - b.p);

  const m = tests.length;
  let runningMin = 1;
  for (let i = m - 1; i >= 0; i -= 1) {
    const rank = i + 1;
    const q = Math.min(runningMin, (tests[i].p * m) / rank, 1);
    runningMin = q;
    const row = output[tests[i].index];
    row.q_value_bh = formatNumber(q);
    row.fdr_significant_05 = String(q < 0.05);
    row.fdr_significant_10 = String(q < 0.10);
  }

  return output;
}

function fdrSummary(families: Record<string, CorrectedRow[]>) {
  const familySummary = Object.entries(families).map(([family, rows]) => {
    const tested = validPRows(rows);
    return {
      family,
      tests: tested.length,
      surviving_q_lt_05: tested.filter((row) => Number(row.q_value_bh) < 0.05).length,
      surviving_q_lt_10: tested.filter((row) => Number(row.q_value_bh) < 0.10).length
    };
  });

  const strongest: FamilyRow[] = Object.entries(families)
    .flatMap(([family, rows]) => validPRows(rows).map((row) => withFamily(family, row)))
    .filter((row) => Number(row.q_value_bh) < 0.10)
    .sort((a, b) => Math.abs(Number(b.cohens_d)) - Math.abs(Number(a.cohens_d)))
    .slice(0, 25);

  const rawHeadlines = rawHeadlineCandidates(families);
  const noLongerFdr05 = rawHeadlines.filter((row) => Number(row.q_value_bh) >= 0.05);
  const noLongerFdr10 = rawHeadlines.filter((row) => Number(row.q_value_bh) >= 0.10);

  return `# Benjamini-Hochberg FDR Summary

Primary FDR families: \`language_effect\`, \`framing_effect\`, \`reasoning_effect\`, and \`foundation_breakdown\`.

\`model_comparison\` is excluded from the primary FDR family because it duplicates model-specific language/framing/reasoning rows already represented in the primary effect tables. It can remain an appendix/reporting table, but it is not counted here.

## Tests Per Family

${markdownTable(familySummary)}

## Strongest Surviving Findings

Sorted by absolute Cohen's d among rows with q < .10.

${markdownTable(strongest.map(displayRow))}

## Raw Headline Findings That Do Not Survive FDR

This compares the top raw-p/effect-size headline candidates from the primary families only. The duplicated \`model_comparison\` headline and reference-divergence rows are not part of this FDR test family.

### Do Not Survive q < .05

${noLongerFdr05.length ? markdownTable(noLongerFdr05.map(displayRow)) : "All primary raw headline candidates survive q < .05."}

### Do Not Survive q < .10

${noLongerFdr10.length ? markdownTable(noLongerFdr10.map(displayRow)) : "All primary raw headline candidates survive q < .10."}
`;
}

function headlineFindingsFdr(families: Record<string, CorrectedRow[]>) {
  const rows: FamilyRow[] = Object.entries(families)
    .flatMap(([family, familyRows]) => validPRows(familyRows).map((row) => withFamily(family, row)))
    .sort((a, b) => {
      const fdrA = Number(a.q_value_bh) < 0.10 ? 0 : 1;
      const fdrB = Number(b.q_value_bh) < 0.10 ? 0 : 1;
      if (fdrA !== fdrB) return fdrA - fdrB;
      const d = Math.abs(Number(b.cohens_d)) - Math.abs(Number(a.cohens_d));
      if (d !== 0) return d;
      return Number(a.q_value_bh) - Number(b.q_value_bh);
    })
    .slice(0, 10);

  const lines = rows.map((row, index) => {
    const survives = Number(row.q_value_bh) < 0.05 ? "survives q < .05" : Number(row.q_value_bh) < 0.10 ? "survives q < .10 only" : "does not survive q < .10";
    return `${index + 1}. ${describe(row)} showed mean_diff=${row.mean_diff}, 95% CI=[${row.ci_lower}, ${row.ci_upper}], p=${row.p_value}, q_BH=${row.q_value_bh}, Cohen's d=${row.cohens_d}, n=${row.n}; ${survives}.`;
  });

  return `# Headline Findings With FDR Correction

Benjamini-Hochberg correction was applied separately within the four primary FDR families: language_effect, framing_effect, reasoning_effect, and foundation_breakdown. \`model_comparison\` is excluded here to avoid double-counting duplicated model-specific effects. Reference-divergence summaries are descriptive and do not enter this p-value FDR family.

Ranked by FDR survival first, then absolute Cohen's d. Effect sizes and confidence intervals are retained so raw magnitude remains visible.

${lines.join("\n")}
`;
}

function rawHeadlineCandidates(families: Record<string, CorrectedRow[]>): FamilyRow[] {
  const candidates: FamilyRow[] = Object.entries(families)
    .flatMap(([family, rows]) => validPRows(rows).map((row) => withFamily(family, row)))
  return candidates
    .sort((a, b) => {
      const d = Math.abs(Number(b.cohens_d)) - Math.abs(Number(a.cohens_d));
      if (d !== 0) return d;
      return Number(a.p_value) - Number(b.p_value);
    })
    .slice(0, 8);
}

function validPRows<T extends Row>(rows: T[]) {
  return rows.filter((row) => Number.isFinite(Number(row.p_value)) && Number.isFinite(Number(row.cohens_d)) && row.n && Number(row.n) > 1);
}

function withFamily(family: string, row: CorrectedRow): FamilyRow {
  return { ...row, family };
}

function displayRow(row: Row) {
  return {
    family: row.family,
    effect_type: row.effect_type,
    model_key: row.model_key,
    language: row.language,
    mft_foundation: row.mft_foundation,
    mean_diff: row.mean_diff,
    ci_lower: row.ci_lower,
    ci_upper: row.ci_upper,
    p_value: row.p_value,
    q_value_bh: row.q_value_bh,
    fdr_significant_05: row.fdr_significant_05,
    fdr_significant_10: row.fdr_significant_10,
    cohens_d: row.cohens_d,
    n: row.n
  };
}

function describe(row: Row) {
  return [
    row.family,
    row.effect_type ? `effect=${row.effect_type}` : "",
    row.model_key ? `model=${row.model_key}` : "",
    row.language ? `language=${row.language}` : "",
    row.mft_foundation && row.mft_foundation !== "all" ? `foundation=${row.mft_foundation}` : ""
  ].filter(Boolean).join(", ");
}

function toCsv(rows: Row[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function markdownTable(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return "_No rows._";
  const headers = Object.keys(rows[0]);
  return [
    `| ${headers.map(escapeMarkdown).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => escapeMarkdown(row[header])).join(" | ")} |`)
  ].join("\n");
}

function escapeMarkdown(value: unknown) {
  return String(value ?? "").replace(/\r?\n/g, "<br>").replace(/\|/g, "\\|");
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "";
  return value.toPrecision(16).replace(/\.?0+$/, "");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
