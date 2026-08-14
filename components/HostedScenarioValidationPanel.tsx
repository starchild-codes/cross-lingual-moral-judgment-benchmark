"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  trial2Foundations,
  type Trial2CoderId,
  type Trial2Foundation,
  type Trial2Response,
  type Trial2Scenario
} from "@/lib/scenario-validation-trial2-shared";

type OrderedScenario = Trial2Scenario & { shown_order: number };
type Draft = { label: Trial2Foundation | ""; notes: string; saved_at: string };
type Drafts = Record<string, Draft>;

const definitions: Record<Trial2Foundation, string> = {
  "Care/Harm": "Concerns suffering, neglect, protection, compassion, or preventing harm.",
  "Fairness/Cheating": "Concerns justice, unequal treatment, dishonesty, bias, cheating, or taking unfair advantage.",
  "Loyalty/Betrayal": "Concerns trust, group obligation, betrayal of friends, family, community, or team, or broken allegiance.",
  "Authority/Subversion": "Concerns duty, hierarchy, role obligation, obedience, institutional authority, respect for superiors or rules, or defiance of legitimate authority.",
  "Sanctity/Degradation": "Concerns sacredness, purity, religious or ritual violation, desecration, contamination, or degradation of something treated as spiritually or culturally sacred."
};

export default function HostedScenarioValidationPanel({
  coderId,
  token,
  items
}: {
  coderId: Trial2CoderId;
  token: string;
  items: OrderedScenario[];
}) {
  const storageKey = `scenario-validation-trial2:${coderId}`;
  const [drafts, setDrafts] = useState<Drafts>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Connecting to secure storage...");
  const [submitted, setSubmitted] = useState(false);
  const [savingScenario, setSavingScenario] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [storageHydrated, setStorageHydrated] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = items[currentIndex] ?? null;
  const currentDraft = current ? drafts[current.scenario_id] ?? emptyDraft() : emptyDraft();
  const completedCount = useMemo(() => items.filter((item) => drafts[item.scenario_id]?.label).length, [drafts, items]);

  useEffect(() => {
    const local = window.localStorage.getItem(storageKey);
    if (local) {
      try {
        const parsed = JSON.parse(local) as { drafts?: Drafts; currentIndex?: number };
        if (parsed.drafts) setDrafts(parsed.drafts);
        if (Number.isInteger(parsed.currentIndex)) setCurrentIndex(Math.max(0, Math.min(items.length - 1, parsed.currentIndex ?? 0)));
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    setStorageHydrated(true);

    void loadBackend();
    // The coder route and token do not change during a coding session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!storageHydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ drafts, currentIndex }));
  }, [currentIndex, drafts, storageHydrated, storageKey]);

  async function loadBackend() {
    setLoading(true);
    try {
      const result = await api<{ responses: Trial2Response[] }>(`/api/validate/${coderId}/responses?token=${encodeURIComponent(token)}`);
      const backendDrafts = Object.fromEntries(result.responses.map((row) => [
        row.scenario_id,
        { label: row.coder_scenario_label, notes: row.coder_notes, saved_at: row.saved_at }
      ]));
      setDrafts((localDrafts) => ({ ...localDrafts, ...backendDrafts }));
      setSubmitted(result.responses.length > 0 && result.responses.every((row) => row.is_submitted));
      setStatus(result.responses.length ? "Progress restored from secure storage." : "Ready. Each response will be saved securely.");
    } catch (error) {
      setStatus(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  function updateLabel(label: Trial2Foundation) {
    if (!current || submitted) return;
    const next = { ...currentDraft, label };
    setDrafts((existing) => ({ ...existing, [current.scenario_id]: next }));
    void persist(current, next);
  }

  function updateNotes(notes: string) {
    if (!current || submitted) return;
    const scenario = current;
    const next = { ...currentDraft, notes };
    setDrafts((existing) => ({ ...existing, [scenario.scenario_id]: next }));
    if (notesTimer.current) clearTimeout(notesTimer.current);
    if (next.label) notesTimer.current = setTimeout(() => void persist(scenario, next), 450);
  }

  async function persist(scenario = current, draft = currentDraft) {
    if (!scenario || !draft.label || submitted) return;
    setSavingScenario(scenario.scenario_id);
    setStatus("Saving...");
    try {
      const result = await api<{ response: Trial2Response }>(`/api/validate/${coderId}/responses?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario_id: scenario.scenario_id,
          coder_scenario_label: draft.label,
          coder_notes: draft.notes
        })
      });
      setDrafts((existing) => ({
        ...existing,
        [scenario.scenario_id]: {
          label: result.response.coder_scenario_label,
          notes: result.response.coder_notes,
          saved_at: result.response.saved_at
        }
      }));
      setStatus(`Saved ${scenario.scenario_id}.`);
    } catch (error) {
      setStatus(`Not saved to backend: ${errorMessage(error)} Your browser backup is still available.`);
    } finally {
      setSavingScenario("");
    }
  }

  function go(offset: number) {
    setCurrentIndex((index) => Math.max(0, Math.min(items.length - 1, index + offset)));
  }

  function firstIncomplete() {
    const index = items.findIndex((item) => !drafts[item.scenario_id]?.label);
    if (index >= 0) setCurrentIndex(index);
  }

  async function submitFinal() {
    if (completedCount !== items.length || submitted) return;
    if (!window.confirm("Submit all 50 responses? Final submission locks this coder's responses.")) return;
    setStatus("Submitting final responses...");
    try {
      await api(`/api/validate/${coderId}/submit?token=${encodeURIComponent(token)}`, { method: "POST" });
      setSubmitted(true);
      setStatus("Final responses submitted successfully. Thank you.");
    } catch (error) {
      setStatus(errorMessage(error));
    }
  }

  async function syncBrowserBackup() {
    if (syncing) return;
    const labeledItems = items.filter((item) => drafts[item.scenario_id]?.label);
    if (!labeledItems.length) {
      setStatus("No labeled browser-backup responses are available to sync.");
      return;
    }

    setSyncing(true);
    setStatus(`Syncing 0 of ${labeledItems.length} browser-backup responses...`);
    try {
      for (let index = 0; index < labeledItems.length; index += 1) {
        const scenario = labeledItems[index];
        const draft = drafts[scenario.scenario_id];
        const result = await api<{ response: Trial2Response }>(`/api/validate/${coderId}/responses?token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario_id: scenario.scenario_id,
            coder_scenario_label: draft.label,
            coder_notes: draft.notes
          })
        });
        setDrafts((existing) => ({
          ...existing,
          [scenario.scenario_id]: {
            label: result.response.coder_scenario_label,
            notes: result.response.coder_notes,
            saved_at: result.response.saved_at
          }
        }));
        setStatus(`Syncing ${index + 1} of ${labeledItems.length} browser-backup responses...`);
      }
      setSubmitted(false);
      setStatus(`Browser backup synced successfully: ${labeledItems.length} responses saved securely.`);
    } catch (error) {
      setStatus(`Sync stopped: ${errorMessage(error)} Your browser backup remains available.`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-9">
      <header className="border-b border-stone-300 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase text-stone-500">Cross-Lingual Moral Judgment Study</p>
            <h1 className="mt-1 text-2xl font-semibold">Scenario Foundation Validation</h1>
          </div>
          <div className="min-w-44 border border-stone-300 bg-white px-4 py-3 text-sm">
            <div className="font-semibold">{coderId}</div>
            <div className="mt-1 text-stone-600">{completedCount} / {items.length} completed</div>
          </div>
        </div>
        <p className="mt-5 max-w-4xl text-sm leading-6 text-stone-700">
          Please read each scenario carefully and choose the Moral Foundations Theory category that best captures the main moral conflict. Some scenarios may involve more than one moral concern, but choose the one that feels most central. Do not try to guess the author&apos;s intended label. Use the notes box only if you are uncertain or if multiple foundations seem equally plausible.
        </p>
        <details className="mt-4 border border-stone-300 bg-white p-4 text-sm">
          <summary className="cursor-pointer font-semibold">MFT category definitions</summary>
          <dl className="mt-3 grid gap-3 md:grid-cols-2">
            {trial2Foundations.map((foundation) => (
              <div key={foundation}>
                <dt className="font-semibold">{foundation}</dt>
                <dd className="mt-1 leading-5 text-stone-600">{definitions[foundation]}</dd>
              </div>
            ))}
          </dl>
        </details>
      </header>

      <div className={`mt-5 border px-4 py-3 text-sm ${submitted ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-stone-300 bg-white text-stone-700"}`} aria-live="polite">
        {loading ? "Loading saved progress..." : status}
      </div>

      {current && (
        <section className="mt-5 border border-stone-300 bg-white">
          <div className="flex items-center justify-between gap-4 border-b border-stone-200 px-5 py-4">
            <div>
              <div className="text-xs font-semibold uppercase text-stone-500">Scenario ID</div>
              <div className="mt-1 text-xl font-semibold">{current.scenario_id}</div>
            </div>
            <div className="text-right text-sm text-stone-600">
              <div>{currentIndex + 1} of {items.length}</div>
              <div className="mt-1">Assigned order {current.shown_order}</div>
            </div>
          </div>

          <div className="px-5 py-6 sm:px-7">
            <p className="whitespace-pre-wrap text-lg leading-8 text-stone-900">{current.scenario_text_en}</p>
          </div>

          <fieldset className="border-t border-stone-200 px-5 py-5 sm:px-7" disabled={submitted || loading}>
            <legend className="font-semibold">Which category best captures the main moral conflict?</legend>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {trial2Foundations.map((foundation) => (
                <label key={foundation} className={`flex min-h-12 cursor-pointer items-center gap-3 border px-3 py-3 ${currentDraft.label === foundation ? "border-teal-700 bg-teal-50" : "border-stone-300 hover:bg-stone-50"}`}>
                  <input type="radio" name={`foundation-${current.scenario_id}`} checked={currentDraft.label === foundation} onChange={() => updateLabel(foundation)} />
                  <span>{foundation}</span>
                </label>
              ))}
            </div>

            <label className="mt-5 block">
              <span className="font-semibold">Optional notes</span>
              <textarea
                className="mt-2 min-h-24 w-full border border-stone-300 px-3 py-2"
                value={currentDraft.notes}
                onChange={(event) => updateNotes(event.target.value)}
                onBlur={() => void persist()}
                placeholder="Add a note only if uncertain or torn between categories"
              />
            </label>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-4 sm:px-7">
            <button type="button" className="border border-stone-300 px-4 py-2 hover:bg-stone-50 disabled:opacity-40" onClick={() => go(-1)} disabled={currentIndex === 0}>Previous</button>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="border border-stone-300 px-4 py-2 hover:bg-stone-50 disabled:opacity-40" onClick={firstIncomplete} disabled={completedCount === items.length}>First incomplete</button>
              <button type="button" className="border border-teal-800 px-4 py-2 text-teal-900 hover:bg-teal-50 disabled:opacity-40" onClick={() => void persist()} disabled={!currentDraft.label || submitted || savingScenario === current.scenario_id}>Save</button>
              <button type="button" className="border border-stone-900 bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => go(1)} disabled={currentIndex === items.length - 1}>Next</button>
            </div>
          </div>
        </section>
      )}

      <section className="mt-5 flex flex-wrap items-center justify-between gap-4 border border-stone-300 bg-white px-5 py-4">
        <div>
          <div className="font-semibold">Final submission</div>
          <div className="mt-1 text-sm text-stone-600">Available after all 50 scenarios have a label.</div>
          <div className="mt-1 text-sm text-stone-600">Browser backup detected: {completedCount} labeled responses.</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="border border-stone-400 px-5 py-2 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => void syncBrowserBackup()} disabled={syncing || !storageHydrated}>
            {syncing ? "Syncing..." : "Sync browser backup"}
          </button>
          <button type="button" className="border border-teal-800 bg-teal-800 px-5 py-2 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40" onClick={() => void submitFinal()} disabled={completedCount !== items.length || submitted || loading || syncing}>
            {submitted ? "Responses submitted" : "Submit final responses"}
          </button>
        </div>
      </section>
    </main>
  );
}

function emptyDraft(): Draft {
  return { label: "", notes: "", saved_at: "" };
}

async function api<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? `Request failed (${response.status}).`);
  return result;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unexpected error.";
}
