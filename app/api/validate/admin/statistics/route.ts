import adminKeyJson from "@/data/scenario_validation_trial2/scenario_validation_admin_key.json";
import { authorizeTrial2Admin, getAllTrial2Responses } from "@/lib/scenario-validation-trial2-server";
import { computeTrial2Statistics, mergeTrial2Responses, type Trial2AdminKeyRow } from "@/lib/scenario-validation-trial2-stats";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!authorizeTrial2Admin(token)) return Response.json({ error: "Invalid admin link." }, { status: 401 });
  try {
    const merged = mergeTrial2Responses(await getAllTrial2Responses(), adminKeyJson as Trial2AdminKeyRow[]);
    return Response.json({ statistics: computeTrial2Statistics(merged) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return Response.json({ error: message }, { status: message.includes("expected 50") ? 409 : 500 });
  }
}
