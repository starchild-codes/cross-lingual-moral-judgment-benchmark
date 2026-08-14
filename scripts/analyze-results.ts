import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { computeAnalysis } from "../lib/analysis";
import { loadRunRatingRows } from "../lib/analysis-data";
import { languages } from "../lib/languages";
import { listRuns, loadWorkUnits } from "../lib/storage";

type EffectRow = {
  lang: string;
  n: number;
  meanDifference: number | null;
  ci95: [number, number] | null;
};

function csvCell(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join("|") : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [columns.join(","), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n") + "\n";
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char);
}

function effectFigure(title: string, subtitle: string, rows: EffectRow[]) {
  const width = 920;
  const height = 500;
  const left = 170;
  const right = 70;
  const top = 95;
  const bottom = 70;
  const values = rows.flatMap((row) => [row.meanDifference ?? 0, ...(row.ci95 ?? [])]);
  const magnitude = Math.max(0.25, ...values.map((value) => Math.abs(value)));
  const bound = Math.ceil(magnitude * 4) / 4;
  const x = (value: number) => left + ((value + bound) / (2 * bound)) * (width - left - right);
  const rowGap = (height - top - bottom) / rows.length;
  const ticks = [-bound, -bound / 2, 0, bound / 2, bound];
  const colors = ["#16697A", "#D1495B", "#2A9D8F", "#7A5195", "#E09F3E", "#3D5A80"];

  const grid = ticks
    .map((tick) => `<line x1="${x(tick)}" y1="${top - 15}" x2="${x(tick)}" y2="${height - bottom + 10}" stroke="${tick === 0 ? "#263238" : "#D8DEE3"}" stroke-width="${tick === 0 ? 1.5 : 1}"/><text x="${x(tick)}" y="${height - 30}" text-anchor="middle" font-size="13" fill="#455A64">${tick.toFixed(2)}</text>`)
    .join("");
  const marks = rows
    .map((row, index) => {
      const y = top + rowGap * (index + 0.5);
      const mean = row.meanDifference ?? 0;
      const [lo, hi] = row.ci95 ?? [mean, mean];
      const label = languages[row.lang as keyof typeof languages]?.name ?? row.lang;
      return `<text x="${left - 18}" y="${y + 5}" text-anchor="end" font-size="15" fill="#263238">${escapeXml(label)}</text>
        <line x1="${x(lo)}" y1="${y}" x2="${x(hi)}" y2="${y}" stroke="${colors[index]}" stroke-width="4"/>
        <line x1="${x(lo)}" y1="${y - 7}" x2="${x(lo)}" y2="${y + 7}" stroke="${colors[index]}" stroke-width="2"/>
        <line x1="${x(hi)}" y1="${y - 7}" x2="${x(hi)}" y2="${y + 7}" stroke="${colors[index]}" stroke-width="2"/>
        <circle cx="${x(mean)}" cy="${y}" r="7" fill="${colors[index]}"/>
        <text x="${Math.min(width - 45, x(hi) + 12)}" y="${y + 5}" font-size="12" fill="#455A64">n=${row.n}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#FFFFFF"/>
    <text x="${left}" y="36" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#17252A">${escapeXml(title)}</text>
    <text x="${left}" y="62" font-family="Arial, sans-serif" font-size="14" fill="#546E7A">${escapeXml(subtitle)}</text>
    <g font-family="Arial, sans-serif">${grid}${marks}</g>
    <text x="${(left + width - right) / 2}" y="${height - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#263238">Mean paired rating difference (95% CI)</text>
  </svg>`;
}

function divergenceFigure(rows: Array<{ modelKey: string; mean: number; n: number }>) {
  const width = 920;
  const height = 440;
  const left = 170;
  const right = 80;
  const top = 95;
  const bottom = 65;
  const max = Math.max(0.5, ...rows.map((row) => row.mean)) * 1.15;
  const x = (value: number) => left + (value / max) * (width - left - right);
  const gap = (height - top - bottom) / rows.length;
  const colors = ["#16697A", "#D1495B", "#2A9D8F"];
  const bars = rows
    .map((row, index) => {
      const y = top + gap * index + 14;
      const barHeight = 48;
      return `<text x="${left - 18}" y="${y + 31}" text-anchor="end" font-size="15" fill="#263238">${escapeXml(row.modelKey)}</text>
        <rect x="${left}" y="${y}" width="${Math.max(1, x(row.mean) - left)}" height="${barHeight}" fill="${colors[index]}"/>
        <text x="${x(row.mean) + 12}" y="${y + 31}" font-size="14" fill="#263238">${row.mean.toFixed(3)} (n=${row.n})</text>`;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#FFFFFF"/>
    <text x="${left}" y="36" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#17252A">Divergence from Gemini Pro</text>
    <text x="${left}" y="62" font-family="Arial, sans-serif" font-size="14" fill="#546E7A">Mean absolute rating difference on identical scenario-condition pairs</text>
    <g font-family="Arial, sans-serif">${bars}</g>
    <line x1="${left}" y1="${height - bottom}" x2="${width - right}" y2="${height - bottom}" stroke="#263238"/>
    <text x="${(left + width - right) / 2}" y="${height - 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#263238">Mean absolute difference</text>
  </svg>`;
}

async function main() {
  const runs = await listRuns();
  const runId = process.env.RUN_ID ?? runs.find((run) => run.mode === "full" && run.status === "completed")?.id;
  if (!runId) throw new Error("Set RUN_ID or complete a full run first.");

  const units = await loadWorkUnits(runId);
  const incomplete = units.filter((unit) => unit.status !== "succeeded" && unit.status !== "skipped");
  if (units.length !== 3000 || incomplete.length) {
    throw new Error(`Run ${runId} is not analysis-ready: ${units.length} units, ${incomplete.length} incomplete.`);
  }
  const ratingUnits = units.filter((unit) => unit.taskType === "rating");
  const qualitativeUnits = units.filter((unit) => unit.taskType === "qualitative");
  const invalidRatings = ratingUnits.filter(
    (unit) => unit.parsedRating === null || unit.parsedRating < 1 || unit.parsedRating > 7 || unit.errorNote
  );
  const emptyQualitative = qualitativeUnits.filter((unit) => !unit.rawOutput?.trim() || unit.errorNote);
  if (ratingUnits.length !== 2500 || qualitativeUnits.length !== 500 || invalidRatings.length || emptyQualitative.length) {
    throw new Error(
      `Run ${runId} failed validation: ${ratingUnits.length} ratings (${invalidRatings.length} invalid), ` +
        `${qualitativeUnits.length} qualitative (${emptyQualitative.length} empty).`
    );
  }

  const rows = await loadRunRatingRows(runId);
  const analysis = computeAnalysis(rows);
  const processedDir = path.join(process.cwd(), "results", "processed");
  const figureDir = path.join(process.cwd(), "results", "figures");
  await Promise.all([mkdir(processedDir, { recursive: true }), mkdir(figureDir, { recursive: true })]);

  const divergenceSummary = ["chatgpt", "claude", "gemini_flash"].map((modelKey) => {
    const values = analysis.referenceDivergence.filter((row) => row.modelKey === modelKey).map((row) => row.absoluteDifference);
    return { modelKey, n: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length };
  });

  await Promise.all([
    writeFile(path.join(processedDir, `${runId}.analysis.json`), JSON.stringify({ runId, ratingRows: rows.length, ...analysis, divergenceSummary }, null, 2), "utf8"),
    writeFile(path.join(processedDir, `${runId}.language-effects.csv`), toCsv(analysis.languageEffects), "utf8"),
    writeFile(path.join(processedDir, `${runId}.framing-effects.csv`), toCsv(analysis.framingEffects), "utf8"),
    writeFile(path.join(processedDir, `${runId}.reasoning-effects.csv`), toCsv(analysis.reasoningEffects), "utf8"),
    writeFile(path.join(processedDir, `${runId}.foundation-breakdown.csv`), toCsv(analysis.foundationBreakdown), "utf8"),
    writeFile(path.join(processedDir, `${runId}.model-comparison.csv`), toCsv(analysis.modelComparison), "utf8"),
    writeFile(path.join(processedDir, `${runId}.reference-divergence.csv`), toCsv(analysis.referenceDivergence), "utf8"),
    writeFile(path.join(figureDir, "01-language-effects.svg"), effectFigure("Language effects", "Translation input with English reasoning minus the English baseline", analysis.languageEffects), "utf8"),
    writeFile(path.join(figureDir, "02-framing-effects.svg"), effectFigure("Cultural framing effects", "Culturally adapted scenario minus literal translation", analysis.framingEffects), "utf8"),
    writeFile(path.join(figureDir, "03-reasoning-effects.svg"), effectFigure("Reasoning-language effects", "Native-language reasoning minus English reasoning", analysis.reasoningEffects), "utf8"),
    writeFile(path.join(figureDir, "04-reference-divergence.svg"), divergenceFigure(divergenceSummary), "utf8")
  ]);

  console.log(
    JSON.stringify(
      {
        runId,
        validation: { total: units.length, ratings: ratingUnits.length, qualitative: qualitativeUnits.length, errors: 0 },
        ratingRows: rows.length,
        divergenceSummary,
        languageEffects: analysis.languageEffects,
        framingEffects: analysis.framingEffects,
        reasoningEffects: analysis.reasoningEffects
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
