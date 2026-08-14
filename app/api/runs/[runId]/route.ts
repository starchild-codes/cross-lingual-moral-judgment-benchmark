import { NextResponse } from "next/server";
import { getRunDetail } from "@/lib/runs";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: { runId: string } }) {
  const detail = await getRunDetail(params.runId);
  if (!detail) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json(detail);
}
