import QualitativeCodingPanel from "@/components/QualitativeCodingPanel";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

export default async function CodingPage() {
  const review = await loadComplianceReview();
  return <QualitativeCodingPanel persistedReview={review} />;
}

async function loadComplianceReview() {
  try {
    const file = await readFile(path.join(process.cwd(), "results", "processed", "language-compliance-review.json"), "utf8");
    return JSON.parse(file) as {
      reviewedAt: string;
      summary: { reviewed: number; correct: number; incorrect: number; truncated: number };
    };
  } catch {
    return null;
  }
}
