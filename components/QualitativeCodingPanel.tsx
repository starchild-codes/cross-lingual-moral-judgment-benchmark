"use client";

import { useEffect, useMemo, useState } from "react";
import { languages } from "@/lib/languages";
import { mftCodes, type MftCode } from "@/lib/mft-labels";

type CodingResponse = {
  responseId: string;
  runId: string;
  modelKey: string;
  scenarioId: string;
  mftCategory: string;
  mftFoundation: string;
  designedFoundation: string;
  conditionId: string;
  inputLang: string;
  reasoningLang: string;
  scenarioVersion: "en" | "translation" | "adapted";
  scenarioTextEnglish: string;
  scenarioText: string;
  response: string;
};

type CodingDecision = {
  responseId: string;
  runId: string;
  modelKey: string;
  scenarioId: string;
  conditionId: string;
  inputLang: string;
  reasoningLang: string;
  scenarioVersion: "en" | "translation" | "adapted";
  code: MftCode | "";
  status: "coded" | "skipped";
  codedAt: string;
};

type PersistedReview = {
  reviewedAt: string;
  summary: { reviewed: number; correct: number; incorrect: number; truncated: number };
} | null;

type CodingPayload = {
  responses: CodingResponse[];
  decisions: CodingDecision[];
  outputFile: string;
  coder: "1" | "2";
};

export default function QualitativeCodingPanel({ persistedReview }: { persistedReview: PersistedReview }) {
  const [payload, setPayload] = useState<CodingPayload | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [coder, setCoder] = useState<"1" | "2">("1");
  const [sessionStartedAt, setSessionStartedAt] = useState<number>(() => Date.now());
  const [codedAtSessionStart, setCodedAtSessionStart] = useState(0);

  const currentStorageKey = `mft-coding:coder-${coder}:current-response`;
  const decisionsStorageKey = `mft-coding:coder-${coder}:decisions`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCoder(params.get("coder") === "2" ? "2" : "1");
  }, []);

  useEffect(() => {
    void load(coder);
  }, [coder]);

  async function load(nextCoder: "1" | "2") {
    const response = await fetch(`/api/coding?coder=${nextCoder}`, { cache: "no-store" });
    const next = (await response.json()) as CodingPayload;
    const local = window.localStorage.getItem(`mft-coding:coder-${nextCoder}:decisions`);
    if (local) {
      const localDecisions = JSON.parse(local) as CodingDecision[];
      const byId = new Map([...next.decisions, ...localDecisions].map((decision) => [decision.responseId, decision]));
      next.decisions = [...byId.values()];
    }
    setPayload(next);
    setSessionStartedAt(Date.now());
    setCodedAtSessionStart(next.decisions.filter((decision) => decision.status === "coded").length);
    const savedId = window.localStorage.getItem(`mft-coding:coder-${nextCoder}:current-response`);
    const savedStillExists = savedId && next.responses.some((entry) => entry.responseId === savedId);
    const nextCurrent = savedStillExists ? savedId : chooseNextResponse(next.responses, next.decisions)?.responseId ?? null;
    setCurrentId(nextCurrent);
  }

  const decisionById = useMemo(() => new Map((payload?.decisions ?? []).map((decision) => [decision.responseId, decision])), [payload]);

  const current = useMemo(() => {
    if (!payload?.responses.length) return null;
    return payload.responses.find((response) => response.responseId === currentId) ?? chooseNextResponse(payload.responses, payload.decisions) ?? payload.responses[0];
  }, [currentId, payload]);

  const currentIndex = current && payload ? payload.responses.findIndex((response) => response.responseId === current.responseId) : -1;
  const codedCount = payload?.decisions.filter((decision) => decision.status === "coded").length ?? 0;
  const skippedCount = payload?.decisions.filter((decision) => decision.status === "skipped").length ?? 0;
  const totalCount = payload?.responses.length ?? 0;
  const currentDecision = current ? decisionById.get(current.responseId) : null;
  const responseLanguage = current ? languages[current.reasoningLang as keyof typeof languages] : null;
  const designedCode = current && mftCodes.includes(current.designedFoundation as MftCode) ? current.designedFoundation as MftCode : null;
  const codedThisSession = Math.max(0, codedCount - codedAtSessionStart);
  const elapsedSeconds = Math.max(1, (Date.now() - sessionStartedAt) / 1000);
  const secondsPerCode = codedThisSession > 0 ? elapsedSeconds / codedThisSession : null;
  const remainingCount = Math.max(0, totalCount - codedCount);
  const eta = secondsPerCode ? formatDuration(secondsPerCode * remainingCount) : "start coding to estimate";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!current || isSaving) return;
      if (/^[1-5]$/.test(event.key)) {
        event.preventDefault();
        void saveDecision(mftCodes[Number(event.key) - 1], "coded");
      } else if (event.key.toLowerCase() === "d" && designedCode) {
        event.preventDefault();
        void saveDecision(designedCode, "coded");
      } else if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveDecision("", "skipped");
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  async function saveDecision(code: MftCode | "", status: "coded" | "skipped") {
    if (!payload || !current) return;
    setIsSaving(true);
    setMessage(null);
    const response = await fetch(`/api/coding?coder=${coder}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        responseId: current.responseId,
        runId: current.runId,
        modelKey: current.modelKey,
        scenarioId: current.scenarioId,
        conditionId: current.conditionId,
        inputLang: current.inputLang,
        reasoningLang: current.reasoningLang,
        scenarioVersion: current.scenarioVersion,
        code,
        status
      })
    });
    if (!response.ok) {
      setIsSaving(false);
      setMessage("Could not save this code. Try again before moving on.");
      return;
    }

    const { decision } = (await response.json()) as { decision: CodingDecision };
    const decisions = [...payload.decisions.filter((entry) => entry.responseId !== decision.responseId), decision];
    window.localStorage.setItem(decisionsStorageKey, JSON.stringify(decisions));
    const nextPayload = { ...payload, decisions };
    setPayload(nextPayload);
    const next = chooseNextResponse(nextPayload.responses, decisions, current.responseId);
    setCurrentId(next?.responseId ?? current.responseId);
    if (next) window.localStorage.setItem(currentStorageKey, next.responseId);
    setMessage(status === "skipped" ? "Skipped/flagged for later review." : `Saved ${code}.`);
    setIsSaving(false);
  }

  function go(offset: number) {
    if (!payload || !current) return;
    const nextIndex = Math.max(0, Math.min(payload.responses.length - 1, currentIndex + offset));
    const nextId = payload.responses[nextIndex]?.responseId ?? current.responseId;
    setCurrentId(nextId);
    window.localStorage.setItem(currentStorageKey, nextId);
  }

  function exportCodes() {
    if (!payload) return;
    const rows = payload.responses.map((response) => {
      const decision = decisionById.get(response.responseId);
      const coded = decision?.status === "coded" ? decision.code : "";
      return {
        response_id: response.responseId,
        scenario_id: response.scenarioId,
        condition_id: response.conditionId,
        model_key: response.modelKey,
        designed_foundation: response.designedFoundation,
        human_coded_foundation: coded,
        is_flagged: decision?.status === "skipped" ? "true" : "false",
        foundation_match: coded ? String(coded === response.designedFoundation) : ""
      };
    });
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `codes_coder${coder}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">MFT Human Coding</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink/70">
            Code the foundation invoked by each qualitative response. Keyboard: 1-5 for foundations, D for designed label, S to skip, left arrow for previous.
          </p>
        </div>
        <div className="border border-line bg-white px-4 py-3 text-sm">
          <div className="font-semibold">Coder {coder}: {codedCount} / {totalCount} coded</div>
          <div className="text-ink/60">{skippedCount} skipped | ETA {eta}</div>
          <button type="button" className="mt-3 border border-line px-3 py-2 hover:bg-paper" onClick={exportCodes}>Export codes</button>
        </div>
      </div>

      {persistedReview && (
        <section className="mt-5 border border-line bg-white px-4 py-3 text-sm text-ink/70">
          Language compliance audit: {persistedReview.summary.correct}/{persistedReview.summary.reviewed} compliant on {persistedReview.reviewedAt};
          {" "}{persistedReview.summary.truncated} token-limited responses flagged separately.
        </section>
      )}

      {!payload && <section className="mt-6 border border-line bg-white p-5 text-sm">Loading qualitative responses...</section>}
      {payload && !current && <section className="mt-6 border border-line bg-white p-5 text-sm">No qualitative responses were found.</section>}

      {payload && current && (
        <section className="mt-6 grid gap-4">
          <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border border-line bg-white px-4 py-3 text-sm shadow-sm">
            <div>
              <span className="font-semibold">Response {currentIndex + 1} of {totalCount}</span>
              <span className="ml-3 text-ink/60">{current.modelKey} | {current.scenarioId} | {current.conditionId}</span>
              <span className="ml-3 text-ink/60">Designed: {current.designedFoundation}</span>
            </div>
            <div className="flex gap-2">
              <button type="button" className="border border-line bg-white px-3 py-2 hover:bg-paper" onClick={() => go(-1)} disabled={currentIndex <= 0}>Previous</button>
              <button type="button" className="border border-line bg-white px-3 py-2 hover:bg-paper" onClick={() => go(1)} disabled={currentIndex >= totalCount - 1}>Next</button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-4">
              <article className="border border-line bg-white p-5">
                <div className="mb-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-ink/60">
                  <span>English Scenario Context</span>
                  <span>Designed: {current.designedFoundation}</span>
                </div>
                <p className="whitespace-pre-wrap leading-7">{current.scenarioTextEnglish || current.scenarioText}</p>
              </article>

              <article className="border border-line bg-white p-5">
                <div className="mb-3 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-wide text-ink/60">
                  <span>Model Response</span>
                  <span>Reasoning: {responseLanguage?.name ?? current.reasoningLang}</span>
                </div>
                <p className="whitespace-pre-wrap leading-7" dir={responseLanguage?.direction}>{current.response}</p>
              </article>
            </div>

            <aside className="sticky top-20 self-start border border-line bg-white p-4">
              <h2 className="text-lg font-semibold">Assign Code</h2>
              <p className="mt-1 text-sm text-ink/60">Saved: {currentDecision?.status === "coded" ? currentDecision.code : currentDecision?.status ?? "none"}</p>
              <div className="mt-3 border border-line bg-paper p-3 text-xs leading-5 text-ink/70">
                <div><strong>Care/Harm:</strong> suffering, neglect, welfare, injury</div>
                <div><strong>Loyalty/Betrayal:</strong> trust, secrecy, betrayal, group duty</div>
                <div><strong>Authority/Subversion:</strong> parent, elder, institution, duty, respect</div>
                <div><strong>Fairness/Cheating:</strong> unfair advantage, bias, merit, cheating</div>
                <div><strong>Sanctity/Degradation:</strong> sacred, purity, pollution, religious violation</div>
              </div>
              <div className="mt-4 grid gap-2">
                {mftCodes.map((code, index) => (
                  <button
                    key={code}
                    type="button"
                    disabled={isSaving}
                    className={`border px-3 py-3 text-left text-sm font-medium hover:bg-paper ${
                      currentDecision?.code === code ? "border-steel bg-steel text-white hover:bg-steel" : "border-line bg-white"
                    }`}
                    onClick={() => saveDecision(code, "coded")}
                  >
                    {index + 1}. {code}
                  </button>
                ))}
                {designedCode && (
                  <button type="button" disabled={isSaving} className="mt-2 border border-steel bg-white px-3 py-3 text-left text-sm font-medium text-steel hover:bg-paper" onClick={() => saveDecision(designedCode, "coded")}>
                    D. Use designed label ({designedCode})
                  </button>
                )}
                <button type="button" disabled={isSaving} className="mt-2 border border-rust bg-white px-3 py-3 text-left text-sm font-medium text-rust hover:bg-paper" onClick={() => saveDecision("", "skipped")}>
                  S. Skip / Unsure
                </button>
              </div>
              {message && <p className="mt-4 text-sm text-ink/70">{message}</p>}
              <p className="mt-5 break-all text-xs text-ink/50">Saving to {payload.outputFile}</p>
            </aside>
          </div>
        </section>
      )}
    </main>
  );
}

function chooseNextResponse(responses: CodingResponse[], decisions: CodingDecision[], currentId?: string) {
  const decided = new Map(decisions.map((decision) => [decision.responseId, decision]));
  const start = currentId ? Math.max(0, responses.findIndex((response) => response.responseId === currentId) + 1) : 0;
  const ordered = [...responses.slice(start), ...responses.slice(0, start)];
  return ordered.find((response) => !decided.has(response.responseId)) ?? ordered.find((response) => decided.get(response.responseId)?.status === "skipped") ?? null;
}

function toCsv(rows: Array<Record<string, string>>) {
  const columns = Object.keys(rows[0] ?? {});
  return `${columns.join(",")}\n${rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.ceil(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
