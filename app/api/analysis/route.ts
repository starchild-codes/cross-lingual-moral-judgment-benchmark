import { NextResponse } from "next/server";
import { computeAnalysis, type RatingRow } from "@/lib/analysis";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rows = (await request.json()) as RatingRow[];
  return NextResponse.json(computeAnalysis(rows));
}
