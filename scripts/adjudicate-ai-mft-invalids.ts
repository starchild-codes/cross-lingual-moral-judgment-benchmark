import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { mftCodes, type MftCode } from "../lib/mft-labels";

type Row = Record<string, string>;

const inputFile = path.join(process.cwd(), "results", "processed", "ai_mft_coding", "ai_mft_codes.csv");
const outputFile = path.join(process.cwd(), "results", "processed", "ai_mft_coding", "ai_mft_codes_adjudicated.csv");
const manualReviewFile = path.join(process.cwd(), "results", "processed", "ai_mft_coding", "ai_mft_manual_adjudications.csv");

const adjudications: Record<string, { label: MftCode; note: string }> = {
  extension_full_1782729062659_xqetbf__chatgpt__S34__ta_adapted_reason_ta__qualitative: {
    label: "Care/Harm",
    note: "Response frames river garbage as environmental harm and irresponsible damage, not sacred pollution."
  },
  extension_full_1782729062659_xqetbf__claude__S30__ja_adapted_reason_ja__qualitative: {
    label: "Care/Harm",
    note: "Response frames safety-rule violation as endangering self and others."
  },
  full_1782215308316_vrq93w__gemini_pro__S06__hi_adapted_reason_hi__qualitative: {
    label: "Loyalty/Betrayal",
    note: "Response explicitly centers betrayed friendship, broken trust, and confidential information."
  },
  full_1782215308316_vrq93w__gemini_pro__S21__bn_translation_reason_en__qualitative: {
    label: "Sanctity/Degradation",
    note: "Response explicitly centers sacred religious boundaries, sanctity, and holy ritual."
  }
};

const disagreementClusterRules: Record<string, { label: MftCode; note: string }> = {
  S11: {
    label: "Authority/Subversion",
    note: "Disagreement adjudication: response centers filial respect, public dishonor, parental dignity, or breach of duty to father."
  },
  S26: {
    label: "Care/Harm",
    note: "Disagreement adjudication: response centers caregiving responsibility and risk from missed medication."
  },
  S34: {
    label: "Care/Harm",
    note: "Disagreement adjudication: response centers environmental harm, damaged ecosystem, public health, or harm to shared natural resources."
  }
};

async function main() {
  const csv = await readFile(inputFile, "utf8");
  const rows = parse(csv, { columns: true, bom: true, skip_empty_lines: true }) as Row[];
  const reviewed: Row[] = [];

  const output = rows.map((row) => {
    const validAgreement = row.llama_label && row.llama_label === row.deepseek_label && row.llama_label !== "INVALID";
    const adjudication = adjudications[row.response_id];
    const clusterRule = !adjudication && !validAgreement ? disagreementClusterRules[row.scenario_id] : undefined;
    const manual = adjudication ?? clusterRule;
    const finalLabel = adjudication?.label ?? (validAgreement ? row.llama_label : "");
    const next = {
      ...row,
      adjudicated_label: manual?.label ?? finalLabel,
      adjudication_source: adjudication ? "manual_invalid_review" : clusterRule ? "manual_disagreement_review" : validAgreement ? "ai_agreement" : "",
      adjudication_note: manual?.note ?? ""
    };
    if (manual) reviewed.push(next);
    return next;
  });

  const missing = Object.keys(adjudications).filter((id) => !rows.some((row) => row.response_id === id));
  if (missing.length) throw new Error(`Adjudication response_id values not found: ${missing.join(", ")}`);

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, toCsv(output), "utf8");
  await writeFile(manualReviewFile, toCsv(reviewed), "utf8");

  const adjudicatedCount = output.filter((row) => row.adjudicated_label).length;
  console.log(`Wrote ${outputFile}`);
  console.log(`Wrote ${manualReviewFile}`);
  console.log(`Rows with adjudicated_label: ${adjudicatedCount}/${output.length}`);
  console.log(`Rows manually adjudicated: ${reviewed.length}`);
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
