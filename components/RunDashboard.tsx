import Link from "next/link";
import { expectedApiCalls } from "@/lib/config";
import { generateConditions } from "@/lib/conditions";
import { languages } from "@/lib/languages";
import { allSystemPrompts } from "@/lib/prompts";
import type { RunRecord, Scenario } from "@/lib/schemas";
import RunControls from "./RunControls";
import RunStatusTable from "./RunStatusTable";

export default function RunDashboard({ scenarios, runs }: { scenarios: Scenario[]; runs: RunRecord[] }) {
  const conditions = generateConditions();
  const prompts = allSystemPrompts();

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <header className="mb-6 flex flex-col gap-3 border-b border-line pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-steel">Research operations</p>
          <h1 className="text-3xl font-semibold text-ink">Cross-lingual moral judgment benchmark</h1>
        </div>
        <nav className="flex gap-2 text-sm">
          <Link className="rounded border border-line px-3 py-2 hover:bg-white" href="/runs">Runs</Link>
          <Link className="rounded border border-line px-3 py-2 hover:bg-white" href="/analysis">Analysis</Link>
          <Link className="rounded border border-line px-3 py-2 hover:bg-white" href="/coding">Coding</Link>
        </nav>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <StatusBox label="Scenarios" value={scenarios.length} note="Expected 25" />
        <StatusBox label="Condition batches" value={conditions.length} note="EN/EN appears once" />
        <StatusBox label="System prompts" value={prompts.length} note="1 baseline + 12 non-English" />
        <StatusBox label="Expected calls" value={expectedApiCalls.total} note="Rating + qualitative" />
      </section>

      <section className="mt-5 border-l-4 border-moss bg-white px-4 py-3 text-sm">
        <strong>Dataset QA complete.</strong> Arabic translation and cultural-adaptation text received native-speaker sign-off on June 24, 2026.
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <h2 className="mb-3 text-lg font-semibold">Dataset Status</h2>
          <div className="table-scroll border border-line bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper">
                <tr>
                  <th className="px-3 py-2">Language</th>
                  <th className="px-3 py-2">Script</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(languages).map((language) => (
                  <tr key={language.code} className="border-t border-line">
                    <td className="px-3 py-2" dir={language.direction}>{language.name} / {language.nativeName}</td>
                    <td className="px-3 py-2">{language.script}</td>
                    <td className="px-3 py-2">
                      <span className="text-moss">{language.qaStatus}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <RunControls />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent Runs</h2>
          <Link className="text-sm font-medium text-steel underline" href="/runs">View all</Link>
        </div>
        <RunStatusTable runs={runs.slice(0, 8)} />
      </section>
    </main>
  );
}

function StatusBox({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="border border-line bg-white p-4">
      <div className="text-sm text-steel">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
      <div className="mt-1 text-xs text-ink/70">{note}</div>
    </div>
  );
}
