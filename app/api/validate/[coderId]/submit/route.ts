import {
  authorizeTrial2Coder,
  submitTrial2Coder,
  trial2IsConfigured
} from "@/lib/scenario-validation-trial2-server";
import { isTrial2CoderId } from "@/lib/scenario-validation-trial2-shared";

export async function POST(request: Request, { params }: { params: { coderId: string } }) {
  if (!isTrial2CoderId(params.coderId)) return Response.json({ error: "Unknown coder." }, { status: 404 });
  const token = new URL(request.url).searchParams.get("token");
  if (!authorizeTrial2Coder(params.coderId, token)) return Response.json({ error: "Invalid coder link." }, { status: 401 });
  if (!trial2IsConfigured()) return Response.json({ error: "Persistent storage is not configured." }, { status: 503 });

  try {
    return Response.json(await submitTrial2Coder(params.coderId));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected server error.";
    return Response.json({ error: message }, { status: message.includes("requires all") ? 400 : 500 });
  }
}
