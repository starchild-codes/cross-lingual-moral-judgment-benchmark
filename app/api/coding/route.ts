import { NextResponse } from "next/server";
import { z } from "zod";
import {
  type CodingDecision,
  coder2CodesFile,
  defaultCodesFile,
  isMftCode,
  loadCodingDecisions,
  loadCodingResponses,
  saveCodingDecision
} from "@/lib/mft-coding";
import type { MftCode } from "@/lib/mft-labels";

export const runtime = "nodejs";

const decisionInput = z.object({
  responseId: z.string().min(1),
  runId: z.string().min(1),
  modelKey: z.string().min(1),
  scenarioId: z.string().min(1),
  conditionId: z.string().min(1),
  inputLang: z.string().min(1),
  reasoningLang: z.string().min(1),
  scenarioVersion: z.enum(["en", "translation", "adapted"]),
  code: z.string(),
  status: z.enum(["coded", "skipped"])
});

function codesFileFor(request: Request) {
  const params = new URL(request.url).searchParams;
  const coder = params.get("coder") === "2" ? "2" : "1";
  return { coder, file: coder === "2" ? coder2CodesFile : defaultCodesFile };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const { coder, file } = codesFileFor(request);
  const full = params.get("full") === "1";
  const [responses, decisions] = await Promise.all([loadCodingResponses(undefined, coder, full), loadCodingDecisions(file)]);
  return NextResponse.json({
    responses,
    decisions,
    outputFile: file,
    coder
  });
}

export async function POST(request: Request) {
  const { file } = codesFileFor(request);
  const body = decisionInput.parse(await request.json());
  if (body.status === "coded" && !isMftCode(body.code)) {
    return NextResponse.json({ error: "Invalid MFT code." }, { status: 400 });
  }

  const decision: CodingDecision = {
    ...body,
    code: body.status === "skipped" ? "" : (body.code as MftCode),
    codedAt: new Date().toISOString()
  };
  await saveCodingDecision(decision, file);
  return NextResponse.json({ decision, outputFile: file });
}
