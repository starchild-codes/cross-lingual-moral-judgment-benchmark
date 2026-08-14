import Link from "next/link";
import type { RunRecord } from "@/lib/schemas";

export default function RunStatusTable({ runs }: { runs: RunRecord[] }) {
  if (!runs.length) {
    return <div className="border border-line bg-white p-4 text-sm text-ink/70">No runs have been created yet.</div>;
  }

  return (
    <div className="table-scroll border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-paper">
          <tr>
            <th className="px-3 py-2">Run</th>
            <th className="px-3 py-2">Mode</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Units</th>
            <th className="px-3 py-2">Updated</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-line">
              <td className="px-3 py-2"><Link className="text-steel underline" href={`/runs/${run.id}`}>{run.id}</Link></td>
              <td className="px-3 py-2">{run.mode}</td>
              <td className="px-3 py-2">{run.status}</td>
              <td className="px-3 py-2">{run.totalUnits}</td>
              <td className="px-3 py-2">{new Date(run.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
