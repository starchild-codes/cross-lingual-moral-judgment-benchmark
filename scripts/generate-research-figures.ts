import { parse } from "csv-parse/sync";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Row = Record<string, string>;
type Primitive =
  | { kind: "text"; x: number; y: number; text: string; size?: number; bold?: boolean; anchor?: "start" | "middle" | "end"; color?: string }
  | { kind: "rect"; x: number; y: number; width: number; height: number; fill: string; stroke?: string }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; stroke?: string; dash?: boolean; width?: number };

const outDir = path.join(process.cwd(), "results", "figures");
const dataDir = path.join(outDir, "data");
const palette = ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9"];
const languages = ["hi", "bn", "ta", "es", "ja", "ar"];
const models = ["chatgpt", "claude", "gemini_flash"];
const foundations = ["Care/Harm", "Loyalty/Betrayal", "Authority/Subversion", "Fairness/Cheating", "Sanctity/Degradation"];

async function main() {
  await mkdir(outDir, { recursive: true });
  const figure1 = await readCsv(path.join(dataDir, "figure1_language_effect_by_model.csv"));
  const figure2 = await readCsv(path.join(dataDir, "figure2_framing_heatmap.csv"));
  const figure3 = await readCsv(path.join(dataDir, "figure3_reasoning_effect_by_model.csv"));
  const figure4 = await readCsv(path.join(dataDir, "figure4_reference_divergence.csv"));

  await writeFigure("figure1_language_effect_by_model", groupedBars(figure1, "Mean blameworthiness rating shift by input language relative to English baseline.", "mean_diff"));
  await writeFigure("figure2_framing_effect_heatmap", heatmap(figure2, "Cultural adaptation effect on blameworthiness ratings by language and moral foundation."));
  await writeFigure("figure3_reasoning_language_effect_by_model", groupedBars(figure3, "Effect of reasoning language on blameworthiness ratings by language.", "mean_diff"));
  await writeFigure("figure4_reference_model_divergence", divergenceBars(figure4, "Mean divergence from Gemini Pro reference model by evaluated model and condition type."));
  console.log(`Wrote SVG and PDF figures to ${outDir}.`);
}

async function readCsv(file: string): Promise<Row[]> {
  return parse(await readFile(file, "utf8"), { columns: true, bom: true, skip_empty_lines: true }) as Row[];
}

async function writeFigure(name: string, primitives: Primitive[]) {
  await writeFile(path.join(outDir, `${name}.svg`), toSvg(primitives), "utf8");
  await writeFile(path.join(outDir, `${name}.pdf`), toPdf(primitives), "binary");
}

function groupedBars(rows: Row[], title: string, valueColumn: string): Primitive[] {
  const width = 1200;
  const height = 760;
  const left = 120;
  const top = 90;
  const plotW = 820;
  const plotH = 470;
  const values = rows.map((row) => Number(row[valueColumn])).filter(Number.isFinite);
  const maxAbs = Math.max(0.25, ...values.flatMap((value) => [Math.abs(value)]));
  const yMax = Math.ceil(maxAbs * 4) / 4;
  const y = (value: number) => top + (yMax - value) / (2 * yMax) * plotH;
  const zeroY = y(0);
  const groupW = plotW / languages.length;
  const barW = 28;
  const p: Primitive[] = base(width, height, title);
  p.push({ kind: "line", x1: left, y1: zeroY, x2: left + plotW, y2: zeroY, stroke: "#333333", dash: true, width: 1.5 });
  for (let tick = -yMax; tick <= yMax + 1e-6; tick += yMax / 2) {
    const ty = y(tick);
    p.push({ kind: "line", x1: left - 5, y1: ty, x2: left + plotW, y2: ty, stroke: tick === 0 ? "#333333" : "#E5E7EB", dash: tick === 0 });
    p.push({ kind: "text", x: left - 12, y: ty + 4, text: tick.toFixed(2), size: 12, anchor: "end", color: "#374151" });
  }
  languages.forEach((lang, langIndex) => {
    const cx = left + langIndex * groupW + groupW / 2;
    p.push({ kind: "text", x: cx, y: top + plotH + 38, text: lang, size: 15, anchor: "middle" });
    models.forEach((model, modelIndex) => {
      const row = rows.find((entry) => entry.language === lang && entry.model_key === model);
      if (!row) return;
      const value = Number(row[valueColumn]);
      const lo = Number(row.ci_lower);
      const hi = Number(row.ci_upper);
      const x = cx + (modelIndex - 1) * (barW + 8) - barW / 2;
      const barY = Math.min(y(value), zeroY);
      const barH = Math.abs(y(value) - zeroY);
      p.push({ kind: "rect", x, y: barY, width: barW, height: Math.max(1, barH), fill: palette[modelIndex] });
      p.push({ kind: "line", x1: x + barW / 2, y1: y(lo), x2: x + barW / 2, y2: y(hi), stroke: "#111827", width: 1 });
      p.push({ kind: "line", x1: x + barW / 2 - 5, y1: y(lo), x2: x + barW / 2 + 5, y2: y(lo), stroke: "#111827", width: 1 });
      p.push({ kind: "line", x1: x + barW / 2 - 5, y1: y(hi), x2: x + barW / 2 + 5, y2: y(hi), stroke: "#111827", width: 1 });
    });
  });
  p.push({ kind: "text", x: left + plotW / 2, y: height - 55, text: "Language", size: 15, anchor: "middle" });
  p.push({ kind: "text", x: 42, y: top + plotH / 2, text: "Mean rating difference", size: 15, anchor: "middle" });
  models.forEach((model, index) => {
    const yLegend = top + 20 + index * 30;
    p.push({ kind: "rect", x: 985, y: yLegend - 12, width: 18, height: 18, fill: palette[index] });
    p.push({ kind: "text", x: 1012, y: yLegend + 2, text: model, size: 14 });
  });
  return p;
}

function heatmap(rows: Row[], title: string): Primitive[] {
  const width = 1200;
  const height = 760;
  const left = 160;
  const top = 130;
  const cellW = 165;
  const cellH = 68;
  const p = base(width, height, title);
  const values = rows.map((row) => Number(row.mean_diff)).filter(Number.isFinite);
  const maxAbs = Math.max(0.1, ...values.map((value) => Math.abs(value)));
  foundations.forEach((foundation, index) => p.push({ kind: "text", x: left + index * cellW + cellW / 2, y: top - 24, text: shortFoundation(foundation), size: 12, anchor: "middle" }));
  languages.forEach((lang, rowIndex) => {
    p.push({ kind: "text", x: left - 18, y: top + rowIndex * cellH + cellH / 2 + 5, text: lang, size: 15, anchor: "end" });
    foundations.forEach((foundation, colIndex) => {
      const matching = rows.filter((row) => row.language === lang && row.mft_foundation === foundation);
      const mean = average(matching.map((row) => Number(row.mean_diff)).filter(Number.isFinite));
      const x = left + colIndex * cellW;
      const y = top + rowIndex * cellH;
      p.push({ kind: "rect", x, y, width: cellW - 4, height: cellH - 4, fill: diverging(mean ?? 0, maxAbs), stroke: "#FFFFFF" });
      p.push({ kind: "text", x: x + cellW / 2, y: y + cellH / 2 + 5, text: mean === null ? "" : mean.toFixed(2), size: 15, anchor: "middle", color: "#111827" });
    });
  });
  return p;
}

function divergenceBars(rows: Row[], title: string): Primitive[] {
  const width = 1200;
  const height = 760;
  const left = 120;
  const top = 100;
  const plotW = 820;
  const plotH = 470;
  const conditionTypes = ["en_en", "translation_reason_en", "translation_reason_l2", "adapted_reason_en", "adapted_reason_l2"];
  const values = rows.map((row) => Number(row.mean_absolute_difference)).filter(Number.isFinite);
  const max = Math.max(1, ...values) * 1.15;
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const groupW = plotW / models.length;
  const barW = 22;
  const p = base(width, height, title);
  for (let tick = 0; tick <= max + 1e-6; tick += max / 4) {
    const ty = y(tick);
    p.push({ kind: "line", x1: left - 5, y1: ty, x2: left + plotW, y2: ty, stroke: "#E5E7EB" });
    p.push({ kind: "text", x: left - 12, y: ty + 4, text: tick.toFixed(2), size: 12, anchor: "end" });
  }
  models.forEach((model, modelIndex) => {
    const cx = left + modelIndex * groupW + groupW / 2;
    p.push({ kind: "text", x: cx, y: top + plotH + 38, text: model, size: 15, anchor: "middle" });
    conditionTypes.forEach((condition, conditionIndex) => {
      const row = rows.find((entry) => entry.model_key === model && entry.condition_type === condition);
      const value = Number(row?.mean_absolute_difference ?? 0);
      const x = cx + (conditionIndex - 2) * (barW + 5) - barW / 2;
      p.push({ kind: "rect", x, y: y(value), width: barW, height: top + plotH - y(value), fill: palette[conditionIndex] });
    });
  });
  conditionTypes.forEach((condition, index) => {
    const yLegend = top + 20 + index * 30;
    p.push({ kind: "rect", x: 960, y: yLegend - 12, width: 18, height: 18, fill: palette[index] });
    p.push({ kind: "text", x: 987, y: yLegend + 2, text: condition, size: 13 });
  });
  return p;
}

function base(width: number, height: number, title: string): Primitive[] {
  return [
    { kind: "rect", x: 0, y: 0, width, height, fill: "#FFFFFF" },
    { kind: "text", x: 60, y: 44, text: title, size: 22, bold: true }
  ];
}

function toSvg(primitives: Primitive[], width = 1200, height = 760) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
${primitives.map(svgPrimitive).join("\n")}
</svg>\n`;
}

function svgPrimitive(p: Primitive) {
  if (p.kind === "rect") return `<rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" fill="${p.fill}"${p.stroke ? ` stroke="${p.stroke}"` : ""}/>`;
  if (p.kind === "line") return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${p.stroke ?? "#111827"}" stroke-width="${p.width ?? 1}"${p.dash ? ' stroke-dasharray="6 5"' : ""}/>`;
  return `<text x="${p.x}" y="${p.y}" text-anchor="${p.anchor ?? "start"}" font-family="Arial, sans-serif" font-size="${p.size ?? 14}"${p.bold ? ' font-weight="700"' : ""} fill="${p.color ?? "#111827"}">${escapeXml(p.text)}</text>`;
}

function toPdf(primitives: Primitive[], width = 1200, height = 760) {
  const commands = primitives.map((p) => pdfPrimitive(p, height)).join("\n");
  const stream = `q\n${commands}\nQ`;
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
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => String(offset).padStart(10, "0") + " 00000 n ").join("\n")}\n`;
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
    return `${r} ${g} ${b} RG\n${p.width ?? 1} w\n${p.dash ? "[6 5] 0 d" : "[] 0 d"}\n${p.x1} ${height - p.y1} m ${p.x2} ${height - p.y2} l S`;
  }
  const font = p.bold ? "F2" : "F1";
  const [r, g, b] = hexRgb(p.color ?? "#111827");
  return `${r} ${g} ${b} rg\nBT /${font} ${p.size ?? 14} Tf ${p.x} ${height - p.y} Td (${escapePdf(p.text)}) Tj ET`;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function diverging(value: number, maxAbs: number) {
  const t = Math.max(-1, Math.min(1, value / maxAbs));
  const blue = [44, 123, 182];
  const red = [215, 48, 39];
  const white = [247, 247, 247];
  const a = t < 0 ? blue : white;
  const b = t < 0 ? white : red;
  const mix = Math.abs(t);
  const rgb = a.map((channel, index) => Math.round(channel + (b[index] - channel) * mix));
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function shortFoundation(value: string) {
  return value.replace("/Betrayal", "").replace("/Subversion", "").replace("/Cheating", "").replace("/Degradation", "");
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
