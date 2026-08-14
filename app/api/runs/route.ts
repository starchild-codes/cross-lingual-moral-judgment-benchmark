import { NextResponse } from "next/server";
import { z } from "zod";
import { createRun, getRunsOverview } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ runs: await getRunsOverview() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = z.object({ mode: z.enum(["pilot", "full"]) }).parse(body);
  const run = await createRun(parsed.mode);
  return NextResponse.json({ run });
}
