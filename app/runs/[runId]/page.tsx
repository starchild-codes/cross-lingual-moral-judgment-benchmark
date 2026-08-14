import Link from "next/link";
import { notFound } from "next/navigation";
import { getRunDetail } from "@/lib/runs";

export default async function RunDetailPage({ params }: { params: { runId: string } }) {
  const detail = await getRunDetail(params.runId);
  if (!detail) notFound();
  const counts = detail.units.reduce<Record<string, number>>((acc, unit) => {
    acc[unit.status] = (acc[unit.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <Link className="text-sm text-steel underline" href="/runs">Runs</Link>
      <h1 className="mt-3 text-2xl font-semibold">{detail.run.id}</h1>
      <section className="mt-4 grid gap-3 md:grid-cols-5">
        {["pending", "running", "succeeded", "failed", "skipped"].map((status) => (
          <div key={status} className="border border-line bg-white p-3">
            <div className="text-sm text-steel">{status}</div>
            <div className="text-xl font-semibold">{counts[status] ?? 0}</div>
          </div>
        ))}
      </section>
      <form action={`/api/runs/${detail.run.id}/step`} method="post" className="mt-4">
        <button className="rounded bg-moss px-3 py-2 text-sm font-medium text-white">Execute next 5 units</button>
      </form>
      <section className="mt-5 table-scroll border border-line bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-paper">
            <tr>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Model</th>
              <th className="px-2 py-2">Scenario</th>
              <th className="px-2 py-2">Condition</th>
              <th className="px-2 py-2">Task</th>
              <th className="px-2 py-2">Rating</th>
              <th className="px-2 py-2">Error</th>
            </tr>
          </thead>
          <tbody>
            {detail.units.slice(0, 200).map((unit) => (
              <tr key={unit.id} className="border-t border-line align-top">
                <td className="px-2 py-2">{unit.status}</td>
                <td className="px-2 py-2">{unit.modelKey}</td>
                <td className="px-2 py-2">{unit.scenarioId}</td>
                <td className="px-2 py-2">{unit.conditionId}</td>
                <td className="px-2 py-2">{unit.taskType}</td>
                <td className="px-2 py-2">{unit.parsedRating ?? "-"}</td>
                <td className="max-w-md px-2 py-2">{unit.errorNote}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
