import type { RatingRow } from "@/lib/analysis";
import { computeAnalysis } from "@/lib/analysis";

export default function AnalysisTables({ rows }: { rows: RatingRow[] }) {
  const analysis = computeAnalysis(rows);
  const divergence = ["chatgpt", "claude", "gemini_flash"].map((modelKey) => {
    const values = analysis.referenceDivergence.filter((row) => row.modelKey === modelKey).map((row) => row.absoluteDifference);
    return {
      modelKey,
      n: values.length,
      mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null,
      max: values.length ? Math.max(...values) : null
    };
  });

  return (
    <div className="space-y-6">
      <EffectTable title="Language Effects" rows={analysis.languageEffects} />
      <EffectTable title="Framing Effects" rows={analysis.framingEffects} />
      <EffectTable title="Reasoning Effects" rows={analysis.reasoningEffects} />
      <GroupedEffectTable title="Foundation Breakdown" groupKey="foundation" rows={analysis.foundationBreakdown} />
      <GroupedEffectTable title="Model Comparison" groupKey="modelKey" rows={analysis.modelComparison} />
      <section>
        <h2 className="mb-2 text-lg font-semibold">Reference Divergence</h2>
        <div className="table-scroll border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-paper"><tr><th className="px-3 py-2">Model</th><th className="px-3 py-2">N</th><th className="px-3 py-2">Mean absolute diff</th><th className="px-3 py-2">Maximum</th></tr></thead>
            <tbody>
              {divergence.map((row) => (
                <tr key={row.modelKey} className="border-t border-line">
                  <td className="px-3 py-2">{row.modelKey}</td><td className="px-3 py-2">{row.n}</td><td className="px-3 py-2">{fmt(row.mean)}</td><td className="px-3 py-2">{fmt(row.max)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function EffectTable({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="table-scroll border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-paper">
            <tr>
              <th className="px-3 py-2">Language</th>
              <th className="px-3 py-2">N</th>
              <th className="px-3 py-2">Mean diff</th>
              <th className="px-3 py-2">t</th>
              <th className="px-3 py-2">Effect size</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.effect}-${row.lang}`} className="border-t border-line">
                <td className="px-3 py-2">{String(row.lang)}</td>
                <td className="px-3 py-2">{String(row.n)}</td>
                <td className="px-3 py-2">{fmt(row.meanDifference)}</td>
                <td className="px-3 py-2">{fmt(row.t)}</td>
                <td className="px-3 py-2">{fmt(row.effectSize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function GroupedEffectTable({ title, groupKey, rows }: { title: string; groupKey: string; rows: Array<Record<string, unknown>> }) {
  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="table-scroll max-h-[32rem] border border-line bg-white">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-paper">
            <tr><th className="px-3 py-2">Group</th><th className="px-3 py-2">Effect</th><th className="px-3 py-2">Language</th><th className="px-3 py-2">N</th><th className="px-3 py-2">Mean diff</th><th className="px-3 py-2">Effect size</th></tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${String(row[groupKey])}-${row.effect}-${row.lang}-${index}`} className="border-t border-line">
                <td className="px-3 py-2">{String(row[groupKey])}</td><td className="px-3 py-2">{String(row.effect)}</td><td className="px-3 py-2">{String(row.lang)}</td><td className="px-3 py-2">{String(row.n)}</td><td className="px-3 py-2">{fmt(row.meanDifference)}</td><td className="px-3 py-2">{fmt(row.effectSize)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function fmt(value: unknown) {
  return typeof value === "number" ? value.toFixed(3) : "-";
}
