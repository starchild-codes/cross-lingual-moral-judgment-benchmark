import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const exportSchema = z.object({
  coderId: z.string().min(1),
  csv: z.string().min(1)
});

const allowedFiles: Record<string, string> = {
  Coder_B: "coder_B_scenario_validation.csv"
};

export async function POST(request: Request) {
  const parsed = exportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Invalid export payload." }, { status: 400 });
  }

  const outputFile = allowedFiles[parsed.data.coderId];
  if (!outputFile) {
    return Response.json({ error: "Only Coder_B project export is enabled from this interface." }, { status: 400 });
  }

  const outputDir = path.join(process.cwd(), "results", "processed", "scenario_validation");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, outputFile);
  await writeFile(outputPath, parsed.data.csv, "utf8");

  return Response.json({ outputPath });
}
