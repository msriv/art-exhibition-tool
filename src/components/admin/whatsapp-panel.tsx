"use client";

import { useCallback, useEffect, useState } from "react";
import { WHATSAPP_STAGES, type WhatsAppStage } from "@/db/enums";

type ParticipantSummary = {
  id: number;
  name: string;
  registrationNumber: string;
  category: string;
};

type StageState = { text: string | null; sentAt: string | null; copyStatus: "idle" | "copied"; sendStatus: "idle" | "sending" | "error" };

const STAGE_LABELS: Record<WhatsAppStage, string> = {
  registered: "Registered",
  accepted: "Accepted",
  results: "Results",
  dispatched: "Dispatched",
};

/**
 * §12's manual WhatsApp workflow — search for a participant, then view and
 * copy ready-made text per stage and mark it sent once actually sent by
 * hand via WhatsApp. No messaging integration; this only reads/writes the
 * marked-sent log.
 */
export function WhatsAppPanel() {
  const [search, setSearch] = useState("");
  const [matches, setMatches] = useState<ParticipantSummary[]>([]);
  const [selected, setSelected] = useState<ParticipantSummary | null>(null);
  const [stages, setStages] = useState<Record<WhatsAppStage, StageState> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runSearch = useCallback(async (signal?: AbortSignal) => {
    if (!search.trim()) {
      setMatches([]);
      return;
    }
    const response = await fetch(`/api/admin/participants?q=${encodeURIComponent(search)}&pageSize=5`, { signal });
    if (signal?.aborted) return;
    if (!response.ok) return;
    const json = (await response.json()) as { rows: ParticipantSummary[] };
    if (signal?.aborted) return;
    setMatches(json.rows);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      runSearch(controller.signal);
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [runSearch]);

  const loadParticipant = useCallback(async (participant: ParticipantSummary, signal?: AbortSignal) => {
    setError(null);
    const [logResponse, ...textResponses] = await Promise.all([
      fetch(`/api/admin/whatsapp-log?participantId=${participant.id}`, { signal }),
      ...WHATSAPP_STAGES.map((stage) =>
        fetch(`/api/admin/whatsapp-text?participantId=${participant.id}&stage=${stage}`, { signal }),
      ),
    ]);
    if (signal?.aborted) return;

    if (!logResponse.ok || textResponses.some((r) => !r.ok)) {
      setError("Could not load this participant's WhatsApp status.");
      return;
    }

    const logJson = (await logResponse.json()) as { log: Record<WhatsAppStage, string | null> };
    const texts = await Promise.all(textResponses.map((r) => r.json() as Promise<{ text: string }>));
    if (signal?.aborted) return;

    const next = {} as Record<WhatsAppStage, StageState>;
    WHATSAPP_STAGES.forEach((stage, i) => {
      next[stage] = { text: texts[i].text, sentAt: logJson.log[stage], copyStatus: "idle", sendStatus: "idle" };
    });
    setStages(next);
  }, []);

  function selectParticipant(participant: ParticipantSummary) {
    setSelected(participant);
    setMatches([]);
    setSearch("");
    loadParticipant(participant);
  }

  async function handleCopy(stage: WhatsAppStage) {
    const text = stages?.[stage]?.text;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStages((prev) => (prev ? { ...prev, [stage]: { ...prev[stage], copyStatus: "copied" } } : prev));
    } catch {
      // Clipboard access can be denied by the browser; the text is still visible to copy by hand.
    }
  }

  async function handleMarkSent(stage: WhatsAppStage) {
    if (!selected) return;
    setStages((prev) => (prev ? { ...prev, [stage]: { ...prev[stage], sendStatus: "sending" } } : prev));
    const response = await fetch("/api/admin/whatsapp-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantId: selected.id, stage }),
    });
    if (!response.ok) {
      setStages((prev) => (prev ? { ...prev, [stage]: { ...prev[stage], sendStatus: "error" } } : prev));
      return;
    }
    const json = (await response.json()) as { markedSentAt: string };
    setStages((prev) =>
      prev ? { ...prev, [stage]: { ...prev[stage], sentAt: json.markedSentAt, sendStatus: "idle" } } : prev,
    );
  }

  return (
    <div>
      <label className="fieldset-label flex-col items-start">
        <span className="text-xs">Search by name, registration #, mobile, or email</span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search participants…"
          className="input input-sm w-80"
        />
      </label>

      {matches.length > 0 && (
        <ul className="menu bg-base-200 mt-2 w-80 rounded-box">
          {matches.map((participant) => (
            <li key={participant.id}>
              <button type="button" onClick={() => selectParticipant(participant)}>
                {participant.name} — {participant.registrationNumber}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      {selected && stages && (
        <div className="mt-6">
          <h2 className="text-base font-semibold">
            {selected.name} — {selected.registrationNumber}
          </h2>
          <div className="mt-4 flex flex-col gap-4">
            {WHATSAPP_STAGES.map((stage) => {
              const state = stages[stage];
              return (
                <div key={stage} className="card bg-base-200">
                  <div className="card-body gap-2">
                    <div className="flex items-center justify-between">
                      <h3 className="card-title text-sm">{STAGE_LABELS[stage]}</h3>
                      <span className="text-base-content/60 text-xs">
                        {state.sentAt ? `Sent ${new Date(state.sentAt).toLocaleString()}` : "Not sent yet"}
                      </span>
                    </div>
                    <textarea readOnly value={state.text ?? ""} rows={3} className="textarea w-full text-sm" />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleCopy(stage)} className="btn btn-sm">
                        {state.copyStatus === "copied" ? "Copied" : "Copy"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkSent(stage)}
                        disabled={state.sendStatus === "sending"}
                        className="btn btn-primary btn-sm"
                      >
                        {state.sendStatus === "sending" ? "Marking…" : "Mark sent"}
                      </button>
                      {state.sendStatus === "error" && <span className="text-error self-center text-xs">Failed</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
