import { z } from "zod";
import {
  authorizeTrial2Coder,
  getTrial2Responses,
  getTrial2Scenarios,
  saveTrial2Response,
  trial2IsConfigured
} from "@/lib/scenario-validation-trial2-server";
import { isTrial2CoderId, trial2Foundations } from "@/lib/scenario-validation-trial2-shared";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  scenario_id: z.string().min(1),
  coder_scenario_label: z.enum(trial2Foundations),
  coder_notes: z.string().max(4000).default("")
});

export async function GET(request: Request, { params }: { params: { coderId: string } }) {
  if (!isTrial2CoderId(params.coderId)) return Response.json({ error: "Unknown coder." }, { status: 404 });
  const token = new URL(request.url).searchParams.get("token");
  if (!authorizeTrial2Coder(params.coderId, token)) return Response.json({ error: "Invalid coder link." }, { status: 401 });
  if (!trial2IsConfigured()) return Response.json({ error: "Persistent storage is not configured." }, { status: 503 });

  try {
    return Response.json({ responses: await getTrial2Responses(params.coderId) });
  } catch (error) {
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { coderId: string } }) {
  if (!isTrial2CoderId(params.coderId)) return Response.json({ error: "Unknown coder." }, { status: 404 });
  const token = new URL(request.url).searchParams.get("token");
  if (!authorizeTrial2Coder(params.coderId, token)) return Response.json({ error: "Invalid coder link." }, { status: 401 });
  if (!trial2IsConfigured()) return Response.json({ error: "Persistent storage is not configured." }, { status: 503 });

  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid response payload." }, { status: 400 });
  }

  const scenario = getTrial2Scenarios(params.coderId).find((item) => item.scenario_id === parsed.data.scenario_id);
  if (!scenario) return Response.json({ error: "Scenario is not part of this coder's assigned set." }, { status: 400 });

  try {
    const response = await saveTrial2Response({
      coder_id: params.coderId,
      scenario_id: scenario.scenario_id,
      shown_order: scenario.shown_order,
      scenario_text_en: scenario.scenario_text_en,
      coder_scenario_label: parsed.data.coder_scenario_label,
      coder_notes: parsed.data.coder_notes,
      saved_at: new Date().toISOString(),
      submitted_at: null,
      is_submitted: false
    });
    return Response.json({ response });
  } catch (error) {
    const message = errorMessage(error);
    return Response.json({ error: message }, { status: message.includes("locked") ? 409 : 500 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected server error.";
}
