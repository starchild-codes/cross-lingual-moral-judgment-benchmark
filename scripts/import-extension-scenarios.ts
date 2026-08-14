import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceFiles = [
  "S01_multilingual_benchmark.csv",
  "S02_to_S05_multilingual_benchmark.csv",
  "S06_to_S10_multilingual_benchmark.csv",
  "S11_to_S15_multilingual_benchmark.csv",
  "S16_to_S20_multilingual_benchmark.csv",
  "S21_to_S25_multilingual_benchmark.csv"
].map((file) => path.join("C:", "Users", "anshi", "Downloads", file));

const outputPath = path.join(process.cwd(), "data", "scenarios_extension.csv");

const columns = [
  "scenario_id",
  "mft_category",
  "mft_foundation",
  "moral_structure_en",
  "text_en",
  "text_hi_b",
  "text_hi_c",
  "text_bn_b",
  "text_bn_c",
  "text_ta_b",
  "text_ta_c",
  "text_es_b",
  "text_es_c",
  "text_ja_b",
  "text_ja_c",
  "text_ar_b",
  "text_ar_c"
] as const;

const foundationMap: Record<string, { category: string; foundation: string }> = {
  Care: { category: "Direct Harm", foundation: "Care/Harm" },
  Loyalty: { category: "Betrayal of Trust", foundation: "Loyalty/Betrayal" },
  Authority: { category: "Defiance of Authority", foundation: "Authority/Subversion" },
  Fairness: { category: "Fairness Violation", foundation: "Fairness/Cheating" },
  Sanctity: { category: "Purity/Sanctity", foundation: "Sanctity/Degradation" }
};

type SourceRow = {
  scenario_id: string;
  mft_foundation: string;
  original_en: string;
  hi_literal: string;
  hi_cultural: string;
  bn_literal: string;
  bn_cultural: string;
  ta_literal: string;
  ta_cultural: string;
  es_literal: string;
  es_cultural: string;
  ja_literal: string;
  ja_cultural: string;
  ar_literal: string;
  ar_cultural: string;
};

async function main() {
  const sourceRows: SourceRow[] = [];
  for (const file of sourceFiles) {
    const csv = await readFile(file, "utf8");
    sourceRows.push(...(parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as SourceRow[]));
  }

  if (sourceRows.length !== 25) {
    throw new Error(`Expected 25 extension scenarios; found ${sourceRows.length}.`);
  }

  const rows = sourceRows.map((row, index) => {
    const mapping = foundationMap[row.mft_foundation];
    if (!mapping) throw new Error(`Unknown foundation family '${row.mft_foundation}' in ${row.scenario_id}.`);
    return {
      scenario_id: `S${String(index + 26).padStart(2, "0")}`,
      mft_category: mapping.category,
      mft_foundation: mapping.foundation,
      moral_structure_en: `Extension source ${row.scenario_id}: ${row.mft_foundation}`,
      text_en: row.original_en,
      text_hi_b: row.hi_literal,
      text_hi_c: row.hi_cultural,
      text_bn_b: row.bn_literal,
      text_bn_c: row.bn_cultural,
      text_ta_b: row.ta_literal,
      text_ta_c: row.ta_cultural,
      text_es_b: row.es_literal,
      text_es_c: row.es_cultural,
      text_ja_b: row.ja_literal,
      text_ja_c: row.ja_cultural,
      text_ar_b: row.ar_literal,
      text_ar_c: row.ar_cultural
    };
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, toCsv(rows), "utf8");
  console.log(`Wrote ${rows.length} extension scenarios to ${outputPath}.`);
}

function toCsv(rows: Array<Record<string, string>>) {
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
