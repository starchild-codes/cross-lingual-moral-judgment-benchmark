import { authorizeTrial2Admin, getAllTrial2Responses } from "@/lib/scenario-validation-trial2-server";
import { isTrial2CoderId, trial2CoderIds } from "@/lib/scenario-validation-trial2-shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!authorizeTrial2Admin(url.searchParams.get("token"))) return Response.json({ error: "Invalid admin link." }, { status: 401 });

  try {
    const rows = await getAllTrial2Responses();
    const requested = url.searchParams.get("coder") ?? "merged";
    if (isTrial2CoderId(requested)) {
      const coderRows = rows.filter((row) => row.coder_id === requested).map((row) => ({
        coder_id: row.coder_id,
        scenario_id: row.scenario_id,
        shown_order: String(row.shown_order),
        scenario_text_en: row.scenario_text_en,
        coder_scenario_label: row.coder_scenario_label,
        coder_notes: row.coder_notes,
        timestamp: row.saved_at,
        is_submitted: String(row.is_submitted)
      }));
      return csvResponse(toCsv(coderRows), `scenario_validation_${requested}.csv`);
    }
    if (requested !== "merged") return Response.json({ error: "Unknown export type." }, { status: 400 });

    const scenarioIds = [...new Set(rows.map((row) => row.scenario_id))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const merged = scenarioIds.map((scenario_id) => {
      const record: Record<string, string> = { scenario_id, scenario_text_en: rows.find((row) => row.scenario_id === scenario_id)?.scenario_text_en ?? "" };
      for (const coderId of trial2CoderIds) {
        const response = rows.find((row) => row.scenario_id === scenario_id && row.coder_id === coderId);
        record[`${coderId}_label`] = response?.coder_scenario_label ?? "";
        record[`${coderId}_notes`] = response?.coder_notes ?? "";
        record[`${coderId}_shown_order`] = response ? String(response.shown_order) : "";
        record[`${coderId}_is_submitted`] = response ? String(response.is_submitted) : "";
      }
      return record;
    });
    return csvResponse(toCsv(merged), "scenario_validation_merged_3coders_coder_safe.csv");
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

function csvResponse(csv: string, filename: string) {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store"
    }
  });
}

function toCsv(rows: Array<Record<string, string>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}
