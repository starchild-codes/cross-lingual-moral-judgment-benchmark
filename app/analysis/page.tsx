import Link from "next/link";
import AnalysisTables from "@/components/AnalysisTables";
import { latestCompletedFullAnalysis } from "@/lib/analysis-data";

export const dynamic = "force-dynamic";

export default async function AnalysisPage() {
  const result = await latestCompletedFullAnalysis();
  const rows = result?.rows ?? [];
  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <Link className="text-sm text-steel underline" href="/">Dashboard</Link>
      <h1 className="mt-3 text-2xl font-semibold">Analysis</h1>
      <p className="mt-2 text-sm text-ink/70">
        {result ? `Showing ${rows.length.toLocaleString()} ratings from ${result.run.id}.` : "Analysis tables populate after a full run completes."}
      </p>
      <div className="mt-5"><AnalysisTables rows={rows} /></div>
    </main>
  );
}
