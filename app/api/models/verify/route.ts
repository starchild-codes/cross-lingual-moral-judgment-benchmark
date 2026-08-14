import { NextResponse } from "next/server";
import { verifyPinnedModels } from "@/lib/openrouter";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json({ results: await verifyPinnedModels() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
