"use client";

import { useCallback, useEffect, useState } from "react";

type SettingRow = { key: string; description: string; value: string | null };
type RowState = { value: string; status: "idle" | "saving" | "saved" | "error"; message?: string };

/** Organizer-editable settings (age cutoff date, UPI ID) — see the API route's own comment for why this exists. */
export function SettingsForm() {
  const [rows, setRows] = useState<SettingRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, RowState>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/admin/settings", { signal });
    if (signal?.aborted) return;
    if (!response.ok) {
      setLoadError("Could not load settings.");
      return;
    }
    const json = (await response.json()) as { settings: SettingRow[] };
    if (signal?.aborted) return;
    setRows(json.settings);
    setEdits(Object.fromEntries(json.settings.map((s) => [s.key, { value: s.value ?? "", status: "idle" as const }])));
  }, []);

  useEffect(() => {
    // Same fetch-in-effect pattern as resource-table.tsx: needs to run on mount,
    // and the abort signal cancels the in-flight request on unmount.
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function handleSave(key: string) {
    const edit = edits[key];
    if (!edit) return;
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], status: "saving" } }));
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: edit.value }),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setEdits((prev) => ({ ...prev, [key]: { ...prev[key], status: "error", message: body?.error } }));
      return;
    }
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], status: "saved" } }));
  }

  if (loadError) {
    return (
      <div role="alert" className="alert alert-error alert-soft text-sm">
        <span>{loadError}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {rows?.map((row) => {
        const edit = edits[row.key];
        if (!edit) return null;
        return (
          <div key={row.key} className="card bg-base-200">
            <div className="card-body gap-2">
              <h2 className="card-title text-sm">{row.key}</h2>
              <p className="text-base-content/70 text-xs">{row.description}</p>
              {row.value === null && (
                <p className="text-warning text-xs">Not set in the database yet — run `npm run db:seed`.</p>
              )}
              <input
                type="text"
                value={edit.value}
                onChange={(e) =>
                  setEdits((prev) => ({ ...prev, [row.key]: { ...prev[row.key], value: e.target.value, status: "idle" } }))
                }
                className="input w-full"
              />
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => handleSave(row.key)} className="btn btn-primary btn-sm self-start">
                  {edit.status === "saving" ? "Saving…" : "Save"}
                </button>
                {edit.status === "saved" && <span className="text-success text-xs">Saved</span>}
                {edit.status === "error" && <span className="text-error text-xs">{edit.message ?? "Failed"}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
