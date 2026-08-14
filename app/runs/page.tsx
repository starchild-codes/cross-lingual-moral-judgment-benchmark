import Link from "next/link";
import RunStatusTable from "@/components/RunStatusTable";
import { getRunsOverview } from "@/lib/runs";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await getRunsOverview();
  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <Link className="text-sm text-steel underline" href="/">Dashboard</Link>
      <h1 className="mt-3 text-2xl font-semibold">Runs</h1>
      <div className="mt-4"><RunStatusTable runs={runs} /></div>
    </main>
  );
}
