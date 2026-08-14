import { authorizeTrial2Admin, getAllTrial2Responses, getTrial2ScenarioCount, trial2IsConfigured } from "@/lib/scenario-validation-trial2-server";
import { trial2CoderIds } from "@/lib/scenario-validation-trial2-shared";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!authorizeTrial2Admin(token)) return Response.json({ error: "Invalid admin link." }, { status: 401 });
  if (!trial2IsConfigured()) return Response.json({ error: "Persistent storage is not configured." }, { status: 503 });
  try {
    const rows = await getAllTrial2Responses();
    const total = getTrial2ScenarioCount();
    return Response.json({
      coders: trial2CoderIds.map((coder_id) => {
        const coderRows = rows.filter((row) => row.coder_id === coder_id);
        const completed = new Set(coderRows.filter((row) => row.coder_scenario_label).map((row) => row.scenario_id)).size;
        return {
          coder_id,
          completed,
          missing: total - completed,
          is_submitted: coderRows.length === total && coderRows.every((row) => row.is_submitted),
          last_saved_at: coderRows.map((row) => row.saved_at).sort().at(-1) ?? null
        };
      }),
      total_scenarios: total
    });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}
