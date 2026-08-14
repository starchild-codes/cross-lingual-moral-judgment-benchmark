import { NextResponse } from "next/server";
import { executeRunStep } from "@/lib/runs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: { runId: string } }) {
  try {
    const result = await executeRunStep(params.runId, 5);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
