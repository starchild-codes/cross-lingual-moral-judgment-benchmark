"use client";

import { useState } from "react";

export default function RunControls() {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function verifyModels() {
    setBusy(true);
    setStatus("Verifying pinned OpenRouter models...");
    const response = await fetch("/api/models/verify", { method: "POST" });
    const body = await response.json();
    setStatus(JSON.stringify(body, null, 2));
    setBusy(false);
  }

  async function createRun(mode: "pilot" | "full") {
    setBusy(true);
    setStatus(`Creating ${mode} run...`);
    const response = await fetch("/api/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode })
    });
    const body = await response.json();
    setStatus(JSON.stringify(body, null, 2));
    setBusy(false);
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">Run Controls</h2>
      <div className="border border-line bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={verifyModels} className="rounded bg-steel px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            Verify models
          </button>
          <button disabled={busy} onClick={() => createRun("pilot")} className="rounded bg-moss px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            Create pilot
          </button>
          <button disabled={busy} onClick={() => createRun("full")} className="rounded bg-ink px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
            Create full run
          </button>
        </div>
        <pre className="mt-4 max-h-72 overflow-auto whitespace-pre-wrap bg-paper p-3 text-xs">{status || "No action yet."}</pre>
      </div>
    </div>
  );
}
