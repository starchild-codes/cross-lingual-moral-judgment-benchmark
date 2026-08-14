import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, string>;
type CsvValue = string | number | boolean | null;
type CsvRow = Record<string, CsvValue>;
type Primitive =
  | { kind: "rect"; x: number; y: number; width: number; height: number; fill: string; stroke?: string }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; stroke?: string; width?: number }
  | { kind: "text"; x: number; y: number; text: string; size?: number; bold?: boolean; anchor?: "start" | "middle" | "end"; color?: string };

const processedDir = path.join(process.cwd(), "results", "processed");
const analysisDir = path.join(processedDir, "analysis");
const figureDir = path.join(process.cwd(), "results", "figures");
const figureDataDir = path.join(figureDir, "data");
const inputFile = path.join(processedDir, "full_merged_with_ai_mft_codes.csv");

const foundations = [
  "Care/Harm",
  "Loyalty/Betrayal",
  "Authority/Subversion",
  "Fairness/Cheating",
  "Sanctity/Degradation"
];

const modelOrder = ["chatgpt", "claude", "gemini_flash", "gemini_pro"];

async function main() {
  await Promise.all([
    mkdir(analysisDir, { recursive: true }),
    mkdir(figureDir, { recursive: true }),
    mkdir(figureDataDir, { recursive: true })
  ]);

  const rows = await readCsv(inputFile);
  const qualitative = rows.filter((row) => row.taskType === "qualitative");
  const coded = qualitative.filter((row) => foundations.includes(row.ai_mft_final_label));
  const uncoded = qualitative.filter((row) => !foundations.includes(row.ai_mft_final_label));

  if (qualitative.length === 0) throw new Error("No qualitative rows found in full_merged_with_ai_mft_codes.csv.");
  if (uncoded.length > 0) throw new Error(`${uncoded.length} qualitative rows are missing a valid ai_mft_final_label.`);

  const matchRows = buildMatchRates(coded);
  const transitionRows = buildTransitions(coded);
  const matrixRows = buildMatrixRows(transitionRows);
  const figureRows = transitionRows.filter((row) => row.model_key !== "all");
  const summary = buildSummary(coded, transitionRows);

  await Promise.all([
    writeFile(path.join(analysisDir, "foundation_match.csv"), toCsv(matchRows), "utf8"),
    writeFile(path.join(analysisDir, "foundation_transitions.csv"), toCsv(transitionRows), "utf8"),
    writeFile(path.join(analysisDir, "foundation_transition_matrix.csv"), toCsv(matrixRows), "utf8"),
    writeFile(path.join(analysisDir, "foundation_coded_analysis_summary.txt"), summary, "utf8"),
    writeFile(path.join(figureDataDir, "figure5_foundation_transitions.csv"), toCsv(figureRows), "utf8")
  ]);

  const primitives = figure5(figureRows);
  await Promise.all([
    writeFile(path.join(figureDir, "figure5_foundation_transition_heatmap.svg"), toSvg(primitives), "utf8"),
    writeFile(path.join(figureDir, "figure5_foundation_transition_heatmap.pdf"), toPdf(primitives), "binary")
  ]);

  console.log(summary);
  console.log(`Wrote Figure 5 SVG/PDF and coded-analysis tables.`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
}

function buildMatchRates(rows: Row[]): CsvRow[] {
  const output: CsvRow[] = [];
  const addGroup = (groupType: string, groupRows: Row[], fields: Partial<CsvRow> = {}) => {
    const matches = groupRows.filter((row) => row.mft_foundation === row.ai_mft_final_label).length;
    output.push({
      group_type: groupType,
      model_key: fields.model_key ?? "all",
      language: fields.language ?? "all",
      condition_type: fields.condition_type ?? "all",
      mft_foundation: fields.mft_foundation ?? "all",
      matches,
      total: groupRows.length,
      match_rate: groupRows.length ? matches / groupRows.length : null
    });
  };

  addGroup("overall", rows);
  for (const modelKey of unique(rows.map((row) => row.modelKey))) addGroup("model", rows.filter((row) => row.modelKey === modelKey), { model_key: modelKey });
  for (const language of unique(rows.map((row) => row.inputLang))) addGroup("language", rows.filter((row) => row.inputLang === language), { language });
  for (const condition of unique(rows.map(conditionType))) addGroup("condition_type", rows.filter((row) => conditionType(row) === condition), { condition_type: condition });
  for (const foundation of foundations) addGroup("mft_foundation", rows.filter((row) => row.mft_foundation === foundation), { mft_foundation: foundation });

  for (const modelKey of unique(rows.map((row) => row.modelKey))) {
    for (const language of unique(rows.map((row) => row.inputLang))) {
      for (const condition of unique(rows.map(conditionType))) {
        for (const foundation of foundations) {
          const groupRows = rows.filter(
            (row) =>
              row.modelKey === modelKey &&
              row.inputLang === language &&
              conditionType(row) === condition &&
              row.mft_foundation === foundation
          );
          if (groupRows.length) {
            addGroup("model_language_condition_foundation", groupRows, {
              model_key: modelKey,
              language,
              condition_type: condition,
              mft_foundation: foundation
            });
          }
        }
      }
    }
  }

  return output;
}

function buildTransitions(rows: Row[]): CsvRow[] {
  const models = [...unique(rows.map((row) => row.modelKey)), "all"];
  const output: CsvRow[] = [];
  for (const modelKey of models) {
    const modelRows = modelKey === "all" ? rows : rows.filter((row) => row.modelKey === modelKey);
    for (const designed of foundations) {
      const designedRows = modelRows.filter((row) => row.mft_foundation === designed);
      for (const invoked of foundations) {
        const count = designedRows.filter((row) => row.ai_mft_final_label === invoked).length;
        output.push({
          model_key: modelKey,
          designed_foundation: designed,
          invoked_foundation: invoked,
          count,
          row_total: designedRows.length,
          row_percentage: designedRows.length ? count / designedRows.length : null
        });
      }
    }
  }
  return output;
}

function buildMatrixRows(transitionRows: CsvRow[]): CsvRow[] {
  const output: CsvRow[] = [];
  for (const modelKey of unique(transitionRows.map((row) => String(row.model_key)))) {
    for (const designed of foundations) {
      const row: CsvRow = { model_key: modelKey, designed_foundation: designed };
      for (const invoked of foundations) {
        const cell = transitionRows.find(
          (entry) =>
            entry.model_key === modelKey &&
            entry.designed_foundation === designed &&
            entry.invoked_foundation === invoked
        );
        row[invoked] = Number(cell?.count ?? 0);
      }
      output.push(row);
    }
  }
  return output;
}

function buildSummary(rows: Row[], transitionRows: CsvRow[]) {
  const matches = rows.filter((row) => row.mft_foundation === row.ai_mft_final_label).length;
  const lines = [
    "Final coded MFT analysis",
    `Qualitative responses coded: ${rows.length}`,
    `Foundation matches: ${matches}/${rows.length} (${percent(matches / rows.length)})`,
    "",
    "Match rate by source model:"
  ];

  for (const modelKey of modelOrder.filter((model) => rows.some((row) => row.modelKey === model))) {
    const modelRows = rows.filter((row) => row.modelKey === modelKey);
    const modelMatches = modelRows.filter((row) => row.mft_foundation === row.ai_mft_final_label).length;
    lines.push(`- ${modelKey}: ${modelMatches}/${modelRows.length} (${percent(modelMatches / modelRows.length)})`);
  }

  const offDiagonal = transitionRows
    .filter((row) => row.model_key === "all" && row.designed_foundation !== row.invoked_foundation && Number(row.count) > 0)
    .sort((a, b) => Number(b.count) - Number(a.count))
    .slice(0, 10);

  lines.push("", "Largest designed -> invoked shifts:");
  for (const row of offDiagonal) {
    lines.push(`- ${row.designed_foundation} -> ${row.invoked_foundation}: ${row.count}`);
  }

  return `${lines.join("\n")}\n`;
}

function conditionType(row: Row) {
  if (row.conditionId === "en_en") return "en_en";
  const reasoning = row.reasoningLang === "en" ? "reason_en" : "reason_l2";
  return `${row.scenarioVersion}_${reasoning}`;
}

function figure5(rows: CsvRow[]): Primitive[] {
  const width = 1500;
  const height = 1080;
  const panelW = 650;
  const panelH = 420;
  const cell = 62;
  const leftPad = 155;
  const topPad = 92;
  const panelOrigins = [
    [72, 145],
    [790, 145],
    [72, 620],
    [790, 620]
  ];
  const models = modelOrder.filter((model) => rows.some((row) => row.model_key === model));
  const p: Primitive[] = [
    { kind: "rect", x: 0, y: 0, width, height, fill: "#FFFFFF" },
    {
      kind: "text",
      x: 60,
      y: 46,
      text: "Figure 5. Designed-to-invoked moral foundation transitions by source model.",
      size: 24,
      bold: true
    },
    { kind: "text", x: 60, y: 78, text: "Rows are designed foundations; columns are coded foundations. Cell shade is row percentage; numbers are counts.", size: 15, color: "#374151" }
  ];

  models.forEach((modelKey, modelIndex) => {
    const [originX, originY] = panelOrigins[modelIndex];
    p.push({ kind: "text", x: originX, y: originY - 24, text: modelKey, size: 18, bold: true });
    p.push({ kind: "text", x: originX + leftPad + (cell * foundations.length) / 2, y: originY + 14, text: "Invoked foundation", size: 13, anchor: "middle", color: "#4B5563" });
    p.push({ kind: "text", x: originX + 4, y: originY + topPad + (cell * foundations.length) / 2, text: "Designed", size: 13, color: "#4B5563" });

    foundations.forEach((foundation, colIndex) => {
      p.push({
        kind: "text",
        x: originX + leftPad + colIndex * cell + cell / 2,
        y: originY + 58,
        text: shortFoundation(foundation),
        size: 10,
        anchor: "middle",
        color: "#111827"
      });
    });

    foundations.forEach((designed, rowIndex) => {
      p.push({
        kind: "text",
        x: originX + leftPad - 12,
        y: originY + topPad + rowIndex * cell + cell / 2 + 4,
        text: shortFoundation(designed),
        size: 11,
        anchor: "end"
      });

      foundations.forEach((invoked, colIndex) => {
        const transition = rows.find(
          (row) =>
            row.model_key === modelKey &&
            row.designed_foundation === designed &&
            row.invoked_foundation === invoked
        );
        const count = Number(transition?.count ?? 0);
        const rowPercentage = Number(transition?.row_percentage ?? 0);
        const x = originX + leftPad + colIndex * cell;
        const y = originY + topPad + rowIndex * cell;
        p.push({ kind: "rect", x, y, width: cell - 3, height: cell - 3, fill: sequentialBlue(rowPercentage), stroke: "#FFFFFF" });
        p.push({ kind: "text", x: x + cell / 2, y: y + cell / 2 + 5, text: String(count), size: 14, bold: count > 0, anchor: "middle", color: rowPercentage > 0.55 ? "#FFFFFF" : "#111827" });
      });
    });
  });

  drawLegend(p, 1240, 82);
  return p;
}

function drawLegend(p: Primitive[], x: number, y: number) {
  p.push({ kind: "text", x, y: y - 16, text: "Row %", size: 12, bold: true });
  for (let i = 0; i <= 5; i++) {
    const value = i / 5;
    p.push({ kind: "rect", x: x + i * 32, y, width: 32, height: 16, fill: sequentialBlue(value) });
  }
  p.push({ kind: "text", x, y: y + 34, text: "0%", size: 11 });
  p.push({ kind: "text", x: x + 192, y: y + 34, text: "100%", size: 11, anchor: "end" });
}

function sequentialBlue(value: number) {
  const t = Math.max(0, Math.min(1, value));
  const low = [239, 246, 255];
  const high = [30, 64, 175];
  const rgb = low.map((channel, index) => Math.round(channel + (high[index] - channel) * t));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function shortFoundation(value: string) {
  return value
    .replace("Care/Harm", "Care")
    .replace("Loyalty/Betrayal", "Loyalty")
    .replace("Authority/Subversion", "Authority")
    .replace("Fairness/Cheating", "Fairness")
    .replace("Sanctity/Degradation", "Sanctity");
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => {
    const ai = modelOrder.indexOf(a);
    const bi = modelOrder.indexOf(b);
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    return a.localeCompare(b);
  });
}

function percent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function toCsv(rows: CsvRow[]) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")).join("\n")}\n`;
}

function csvEscape(value: CsvValue) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toSvg(primitives: Primitive[], width = 1500, height = 1080) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${primitives.map(svgPrimitive).join("\n")}
</svg>\n`;
}

function svgPrimitive(p: Primitive) {
  if (p.kind === "rect") return `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}"` : ""}/>`;
  if (p.kind === "line") return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke ?? "#111827"}" stroke-width="${p.width ?? 1}"/>`;
  return `<text x="${p.x}" y="${p.y}" text-anchor="${p.anchor ?? "start"}" font-family="Arial, sans-serif" font-size="${p.size ?? 14}"${p.bold ? ' font-weight="700"' : ""} fill="${p.color ?? "#111827"}">${escapeXml(p.text)}</text>`;
}

function toPdf(primitives: Primitive[], width = 1500, height = 1080) {
  const stream = `q\n${primitives.map((p) => pdfPrimitive(p, height)).join("\n")}\nQ`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return body;
}

function pdfPrimitive(p: Primitive, height: number) {
  if (p.kind === "rect") {
    const [r, g, b] = hexRgb(p.fill);
    return `${r} ${g} ${b} rg\n${p.x} ${height - p.y - p.height} ${p.width} ${p.height} re f`;
  }
  if (p.kind === "line") {
    const [r, g, b] = hexRgb(p.stroke ?? "#111827");
    return `${r} ${g} ${b} RG\n${p.width ?? 1} w\n${p.x1} ${height - p.y1} m ${p.x2} ${height - p.y2} l S`;
  }
  const font = p.bold ? "F2" : "F1";
  const [r, g, b] = hexRgb(p.color ?? "#111827");
  return `${r} ${g} ${b} rg\nBT /${font} ${p.size ?? 14} Tf ${p.x} ${height - p.y} Td (${escapePdf(p.text)}) Tj ET`;
}

function hexRgb(hex: string) {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255);
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

function escapePdf(value: string) {
  return value.replace(/[\\()]/g, "\\$&").replace(/[^\x20-\x7E]/g, "?");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
