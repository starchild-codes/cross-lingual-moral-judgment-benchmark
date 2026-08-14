"use client";

import { useEffect, useState } from "react";
import { trial2CoderIds, type Trial2CoderId } from "@/lib/scenario-validation-trial2-shared";

type CoderStatus = {
  coder_id: Trial2CoderId;
  completed: number;
  missing: number;
  is_submitted: boolean;
  last_saved_at: string | null;
};

type StatusResponse = { coders: CoderStatus[]; total_scenarios: number };
type Statistics = {
  pairwise: Array<{ pair: string; raw_agreement: number; cohens_kappa: number }>;
  mean_pairwise_cohens_kappa: number;
  fleiss_kappa: number;
  majority_vote_agreement_with_intended: number;
};

export default function Trial2AdminDashboard({
  adminToken,
  coderTokens
}: {
  adminToken: string;
  coderTokens: Record<string, string>;
}) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [message, setMessage] = useState("Loading completion status...");

  useEffect(() => {
    void refresh();
    // Token is fixed for the page lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setMessage("Refreshing...");
    try {
      const result = await api<StatusResponse>(`/api/validate/admin/status?token=${encodeURIComponent(adminToken)}`);
      setStatus(result);
      setMessage("Status is current.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  async function compute() {
    setMessage("Computing three-coder statistics...");
    try {
      const result = await api<{ statistics: Statistics }>(`/api/validate/admin/statistics?token=${encodeURIComponent(adminToken)}`, { method: "POST" });
      setStatistics(result.statistics);
      setMessage("Statistics computed from the current database responses.");
    } catch (error) {
      setMessage(errorMessage(error));
    }
  }

  function coderLink(coderId: Trial2CoderId) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/validate/${coderId}?token=${encodeURIComponent(coderTokens[coderId] ?? "")}`;
  }

  function exportLink(coder: string) {
    return `/api/validate/admin/export?token=${encodeURIComponent(adminToken)}&coder=${encodeURIComponent(coder)}`;
  }

  const allComplete = status?.coders.every((coder) => coder.completed === status.total_scenarios && coder.is_submitted) ?? false;

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase text-stone-500">Private administration</p>
          <h1 className="mt-1 text-2xl font-semibold">Trial 2 Scenario Validation</h1>
          <p className="mt-2 text-sm text-stone-600">Three blinded coders, 50 English scenarios each, persistent Supabase storage.</p>
        </div>
        <button type="button" onClick={() => void refresh()} className="border border-stone-300 bg-white px-4 py-2 hover:bg-stone-50">Refresh status</button>
      </div>

      <div className="mt-5 border border-stone-300 bg-white px-4 py-3 text-sm" aria-live="polite">{message}</div>

      <section className="mt-5 overflow-x-auto border border-stone-300 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-stone-100">
            <tr>{["Coder", "Completed", "Missing", "Final submission", "Last saved", "Export"].map((label) => <th key={label} className="border-b border-stone-300 px-4 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody>
            {(status?.coders ?? trial2CoderIds.map((coder_id) => ({ coder_id, completed: 0, missing: 50, is_submitted: false, last_saved_at: null }))).map((coder) => (
              <tr key={coder.coder_id}>
                <td className="border-b border-stone-200 px-4 py-3 font-semibold">{coder.coder_id}</td>
                <td className="border-b border-stone-200 px-4 py-3">{coder.completed} / {status?.total_scenarios ?? 50}</td>
                <td className="border-b border-stone-200 px-4 py-3">{coder.missing}</td>
                <td className="border-b border-stone-200 px-4 py-3">{coder.is_submitted ? "Submitted" : "Not submitted"}</td>
                <td className="border-b border-stone-200 px-4 py-3">{coder.last_saved_at ? new Date(coder.last_saved_at).toLocaleString() : "No saves"}</td>
                <td className="border-b border-stone-200 px-4 py-3"><a className="underline" href={exportLink(coder.coder_id)}>CSV</a></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-5 border border-stone-300 bg-white p-5">
        <h2 className="text-lg font-semibold">Private coder links</h2>
        <p className="mt-1 text-sm text-stone-600">Send each coder only their own link.</p>
        <div className="mt-4 grid gap-3">
          {trial2CoderIds.map((coderId) => (
            <div key={coderId} className="grid gap-2 border border-stone-200 p-3 md:grid-cols-[100px_1fr_auto] md:items-center">
              <span className="font-semibold">{coderId}</span>
              <input readOnly value={coderLink(coderId)} className="min-w-0 border border-stone-300 px-3 py-2 text-sm" />
              <button type="button" className="border border-stone-300 px-3 py-2 hover:bg-stone-50" onClick={() => void navigator.clipboard.writeText(coderLink(coderId))}>Copy link</button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 border border-stone-300 bg-white p-5">
        <div>
          <h2 className="font-semibold">Exports and validation statistics</h2>
          <p className="mt-1 text-sm text-stone-600">Statistics are enabled after all three final submissions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a className="border border-stone-300 px-4 py-2 hover:bg-stone-50" href={exportLink("merged")}>Export merged CSV</a>
          <button type="button" onClick={() => void compute()} disabled={!allComplete} className="border border-stone-900 bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40">Compute statistics</button>
        </div>
      </section>

      {statistics && (
        <section className="mt-5 border border-stone-300 bg-white p-5">
          <h2 className="text-lg font-semibold">Current statistics</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {statistics.pairwise.map((row) => (
              <div key={row.pair} className="border border-stone-200 p-4">
                <div className="font-semibold">{row.pair.replaceAll("_", " ")}</div>
                <div className="mt-2 text-sm">Raw agreement: {(row.raw_agreement * 100).toFixed(2)}%</div>
                <div className="mt-1 text-sm">Cohen&apos;s kappa: {row.cohens_kappa.toFixed(4)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm leading-6">
            Mean pairwise Cohen&apos;s kappa: {statistics.mean_pairwise_cohens_kappa.toFixed(4)}<br />
            Fleiss&apos; kappa: {statistics.fleiss_kappa.toFixed(4)}<br />
            Majority-vote agreement with intended labels: {(statistics.majority_vote_agreement_with_intended * 100).toFixed(2)}%
          </div>
        </section>
      )}
    </main>
  );
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
  return result;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}
