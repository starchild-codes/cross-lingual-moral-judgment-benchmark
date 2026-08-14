import { parse } from "csv-parse/sync";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, string>;

const processedDir = path.join(process.cwd(), "results", "processed");
const mergedInput = path.join(processedDir, "full_merged.csv");
const codesInput = path.join(processedDir, "ai_mft_coding", "ai_mft_codes_adjudicated.csv");
const outputFile = path.join(processedDir, "full_merged_with_ai_mft_codes.csv");

async function main() {
  const [mergedCsv, codesCsv] = await Promise.all([readFile(mergedInput, "utf8"), readFile(codesInput, "utf8")]);
  const rows = parse(mergedCsv, { columns: true, bom: true, skip_empty_lines: true }) as Row[];
  const codes = parse(codesCsv, { columns: true, bom: true, skip_empty_lines: true }) as Row[];
  const codeById = new Map(codes.map((row) => [row.response_id, row]));

  const output: Row[] = rows.map((row): Row => {
    const code = codeById.get(row.response_id);
    const finalLabel = code?.adjudicated_label ?? "";
    return {
      ...row,
      ai_mft_llama_label: code?.llama_label ?? "",
      ai_mft_deepseek_label: code?.deepseek_label ?? "",
      ai_mft_final_label: finalLabel,
      ai_mft_code_source: code?.adjudication_source ?? "",
      ai_mft_code_note: code?.adjudication_note ?? "",
      ai_mft_matches_designed_foundation: finalLabel ? String(finalLabel === row.mft_foundation) : ""
    };
  });

  const qualitativeRows = rows.filter((row) => row.taskType === "qualitative").length;
  const codedQualitativeRows = output.filter((row) => row.taskType === "qualitative" && row.ai_mft_final_label).length;
  const missingCodes = rows.filter((row) => row.taskType === "qualitative" && !codeById.has(row.response_id));
  if (codedQualitativeRows !== qualitativeRows || missingCodes.length) {
    throw new Error(`Expected all qualitative rows to have final AI MFT codes; coded ${codedQualitativeRows}/${qualitativeRows}, missing ${missingCodes.length}.`);
  }

  await writeFile(outputFile, toCsv(output), "utf8");
  console.log(`Wrote ${outputFile}`);
  console.log(`Qualitative rows with final AI MFT code: ${codedQualitativeRows}/${qualitativeRows}`);
}

function toCsv(rows: Row[]) {
  const columns = Object.keys(rows[0] ?? {});
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
