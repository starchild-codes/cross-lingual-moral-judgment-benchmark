"use client";

import { useEffect, useMemo, useState } from "react";
import { mftCodes, type MftCode } from "@/lib/mft-labels";

type ScenarioValidationItem = {
  scenario_id: string;
  scenario_text_en: string;
};

type ValidationMode = "full" | "authority";

type CoderResponse = {
  label: MftCode | "";
  notes: string;
  timestamp: string;
};

type ResponsesByScenario = Record<string, CoderResponse>;

export default function ScenarioValidationPanel({
  fullItems,
  authorityItems,
  dataAvailable
}: {
  fullItems: ScenarioValidationItem[];
  authorityItems: ScenarioValidationItem[];
  dataAvailable: boolean;
}) {
  const [mode, setMode] = useState<ValidationMode>("full");
  const [coderId, setCoderId] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [responses, setResponses] = useState<ResponsesByScenario>({});
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const nextCoderId = params.get("coder") === "Coder_B" ? "Coder_B" : window.localStorage.getItem("scenario-validation:coder-id") ?? "";
    setMode(params.get("mode") === "authority" && nextCoderId !== "Coder_B" ? "authority" : "full");
    setCoderId(nextCoderId);
    if (nextCoderId) window.localStorage.setItem("scenario-validation:coder-id", nextCoderId);
  }, []);

  const sourceItems = mode === "authority" ? authorityItems : fullItems;
  const storageKey = `scenario-validation:${mode}:${coderId || "anonymous"}`;
  const indexKey = `${storageKey}:current-index`;
  const orderSeed = `${mode}:${coderId || "anonymous"}`;

  const orderedItems = useMemo(() => seededShuffle(sourceItems, orderSeed), [sourceItems, orderSeed]);
  const current = orderedItems[currentIndex] ?? orderedItems[0] ?? null;
  const currentResponse = current ? responses[current.scenario_id] ?? emptyResponse() : emptyResponse();
  const codedCount = orderedItems.filter((item) => responses[item.scenario_id]?.label).length;

  useEffect(() => {
    if (!dataAvailable) return;
    const saved = window.localStorage.getItem(storageKey);
    setResponses(saved ? JSON.parse(saved) as ResponsesByScenario : {});
    const savedIndex = Number(window.localStorage.getItem(indexKey));
    setCurrentIndex(Number.isInteger(savedIndex) && savedIndex >= 0 ? savedIndex : 0);
  }, [dataAvailable, storageKey, indexKey]);

  useEffect(() => {
    if (currentIndex >= orderedItems.length) setCurrentIndex(Math.max(0, orderedItems.length - 1));
  }, [currentIndex, orderedItems.length]);

  function updateCoderId(value: string) {
    setCoderId(value);
    window.localStorage.setItem("scenario-validation:coder-id", value);
  }

  function updateResponse(update: Partial<CoderResponse>) {
    if (!current) return;
    const next = {
      ...responses,
      [current.scenario_id]: {
        ...emptyResponse(),
        ...responses[current.scenario_id],
        ...update,
        timestamp: new Date().toISOString()
      }
    };
    setResponses(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function go(offset: number) {
    const nextIndex = Math.max(0, Math.min(orderedItems.length - 1, currentIndex + offset));
    setCurrentIndex(nextIndex);
    window.localStorage.setItem(indexKey, String(nextIndex));
  }

  function jumpToFirstUncoded() {
    const nextIndex = orderedItems.findIndex((item) => !responses[item.scenario_id]?.label);
    if (nextIndex >= 0) {
      setCurrentIndex(nextIndex);
      window.localStorage.setItem(indexKey, String(nextIndex));
    }
  }

  function switchMode(nextMode: ValidationMode) {
    if (coderId === "Coder_B" && nextMode !== "full") return;
    setMode(nextMode);
    setCurrentIndex(0);
    const url = new URL(window.location.href);
    if (nextMode === "authority") url.searchParams.set("mode", "authority");
    else url.searchParams.delete("mode");
    window.history.replaceState(null, "", url.toString());
  }

  function exportCsv() {
    downloadCsv(buildCsv());
  }

  async function saveCoderBToProject() {
    setSaveMessage("");
    const csv = buildCsv();
    const response = await fetch("/api/scenario-validation/export", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coderId, csv })
    });
    if (!response.ok) {
      setSaveMessage("Could not save Coder B CSV to the project folder.");
      return;
    }
    const result = await response.json() as { outputPath: string };
    setSaveMessage(`Saved to ${result.outputPath}`);
  }

  function buildCsv() {
    const rows = orderedItems.map((item, index) => {
      const response = responses[item.scenario_id] ?? emptyResponse();
      return {
        coder_id: coderId,
        validation_mode: mode === "full" ? "full_blinded" : "authority_only_internal_review",
        scenario_id: item.scenario_id,
        shown_order: String(index + 1),
        scenario_text_en: item.scenario_text_en,
        coder_scenario_label: response.label,
        coder_notes: response.notes,
        timestamp: response.timestamp
      };
    });
    return toCsv(rows);
  }

  function downloadCsv(csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeCoder = (coderId || "anonymous").replace(/[^a-z0-9_-]+/gi, "_");
    link.href = url;
    link.download = `scenario_validation_${mode}_${safeCoder}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!dataAvailable) {
    return (
      <main className="mx-auto max-w-4xl px-5 py-8">
        <h1 className="text-2xl font-semibold">Scenario MFT Validation</h1>
        <p className="mt-3 text-sm text-stone-700">
          Extract the validation data first, then reload this page.
        </p>
        <pre className="mt-4 overflow-auto border border-stone-300 bg-white p-4 text-sm">corepack pnpm scenario-validation-extract</pre>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Scenario MFT Validation</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-700">
            Please read each scenario carefully and choose the Moral Foundations Theory category that best captures the main moral conflict. Some scenarios may involve more than one moral concern, but choose the one that feels most central. Do not try to guess the author&apos;s intended label. Use the notes box only if you are uncertain or if multiple foundations seem equally plausible.
          </p>
        </div>
        <div className="border border-stone-300 bg-white px-4 py-3 text-sm">
          <div className="font-semibold">{codedCount} / {orderedItems.length} labeled</div>
          <div className="mt-1 text-stone-600">Scenario {orderedItems.length ? currentIndex + 1 : 0} of {orderedItems.length}</div>
          <button type="button" className="mt-3 border border-stone-300 px-3 py-2 hover:bg-stone-50" onClick={exportCsv}>
            Download CSV
          </button>
          {coderId === "Coder_B" && (
            <button
              type="button"
              className="mt-2 block border border-stone-900 bg-stone-900 px-3 py-2 text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={saveCoderBToProject}
              disabled={codedCount !== orderedItems.length}
            >
              Save Coder B CSV
            </button>
          )}
          {saveMessage && <div className="mt-2 max-w-xs break-words text-xs text-stone-600">{saveMessage}</div>}
        </div>
      </div>

      <section className="mt-5 grid gap-3 border border-stone-300 bg-white p-4 md:grid-cols-[1fr_auto]">
        <label className="text-sm">
          <span className="font-medium">Coder ID</span>
          <input
            className="mt-1 block w-full border border-stone-300 px-3 py-2"
            value={coderId}
            onChange={(event) => updateCoderId(event.target.value)}
            placeholder="e.g. coder_a"
          />
        </label>
        <div className="flex items-end gap-2">
          <button
            type="button"
            className={`border px-3 py-2 text-sm ${mode === "full" ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 hover:bg-stone-50"}`}
            onClick={() => switchMode("full")}
          >
            Full blinded
          </button>
          <button
            type="button"
            className={`border px-3 py-2 text-sm ${mode === "authority" ? "border-stone-900 bg-stone-900 text-white" : "border-stone-300 hover:bg-stone-50"}`}
            onClick={() => switchMode("authority")}
            disabled={coderId === "Coder_B"}
          >
            Authority-only
          </button>
        </div>
      </section>

      {mode === "authority" && (
        <div className="mt-4 border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Authority-only mode is for quick internal checking and is not fully blinded. The intended label is still hidden from this interface and from exports.
        </div>
      )}

      {current && (
        <section className="mt-5 border border-stone-300 bg-white">
          <div className="border-b border-stone-200 px-5 py-4">
            <div className="text-sm font-semibold text-stone-500">Scenario ID</div>
            <div className="mt-1 text-xl font-semibold">{current.scenario_id}</div>
          </div>

          <div className="px-5 py-5">
            <div className="text-sm font-semibold text-stone-500">English Scenario Text</div>
            <p className="mt-3 whitespace-pre-wrap text-lg leading-8 text-stone-900">{current.scenario_text_en}</p>
          </div>

          <div className="border-t border-stone-200 px-5 py-5">
            <fieldset>
              <legend className="font-semibold">Best-fitting MFT category</legend>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {mftCodes.map((code) => (
                  <label key={code} className="flex cursor-pointer items-center gap-3 border border-stone-300 px-3 py-3 hover:bg-stone-50">
                    <input
                      type="radio"
                      name="mft-code"
                      checked={currentResponse.label === code}
                      onChange={() => updateResponse({ label: code })}
                    />
                    <span>{code}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="mt-5 block">
              <span className="font-semibold">Optional notes</span>
              <textarea
                className="mt-2 min-h-24 w-full border border-stone-300 px-3 py-2"
                value={currentResponse.notes}
                onChange={(event) => updateResponse({ notes: event.target.value })}
                placeholder="Optional uncertainty note for this scenario"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-4">
            <button type="button" className="border border-stone-300 px-4 py-2 hover:bg-stone-50 disabled:opacity-40" onClick={() => go(-1)} disabled={currentIndex <= 0}>
              Previous
            </button>
            <button type="button" className="border border-stone-300 px-4 py-2 hover:bg-stone-50" onClick={jumpToFirstUncoded}>
              First uncoded
            </button>
            <button type="button" className="border border-stone-900 bg-stone-900 px-4 py-2 text-white hover:bg-stone-700 disabled:opacity-40" onClick={() => go(1)} disabled={currentIndex >= orderedItems.length - 1}>
              Next
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

function emptyResponse(): CoderResponse {
  return { label: "", notes: "", timestamp: "" };
}

function seededShuffle<T>(items: T[], seed: string) {
  const keyed = items.map((item, index) => ({ item, key: hashString(`${seed}:${index}:${JSON.stringify(item)}`) }));
  return keyed.sort((a, b) => a.key - b.key).map((entry) => entry.item);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function toCsv(rows: Array<Record<string, string>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  return `${headers.join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header] ?? "")).join(",")).join("\n")}\n`;
}

function csvCell(value: string) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
