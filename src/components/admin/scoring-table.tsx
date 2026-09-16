"use client";

import { useCallback, useEffect, useState } from "react";
import type { Category } from "@/db/enums";

type Entry = {
  entryId: number;
  title: string;
  medium: string;
  participantId: number;
  participantName: string;
  registrationNumber: string;
  category: Category;
  score: number | null;
  scoringComplete: boolean;
};

type RowState = { score: string; scoringComplete: boolean; status: "idle" | "saving" | "saved" | "error" };

const CATEGORY_OPTIONS: { value: Category | ""; label: string }[] = [
  { value: "", label: "All categories" },
  { value: "1", label: "Category 1" },
  { value: "2", label: "Category 2" },
  { value: "3", label: "Category 3" },
];

/**
 * Scoring workflow (§11) — one row per entry, editable inline, saved
 * explicitly rather than on every keystroke (matches ResourceForm's
 * explicit-submit pattern elsewhere in the admin dashboard).
 */
export function ScoringTable() {
  const [category, setCategory] = useState<Category | "">("");
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const params = category ? `?category=${category}` : "";
      const response = await fetch(`/api/admin/scoring${params}`, { signal });
      if (signal?.aborted) return;
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not load entries.");
        return;
      }
      const json = (await response.json()) as { entries: Entry[] };
      if (signal?.aborted) return;
      setError(null);
      setEntries(json.entries);
      setRows(
        Object.fromEntries(
          json.entries.map((entry) => [
            entry.entryId,
            { score: entry.score === null ? "" : String(entry.score), scoringComplete: entry.scoringComplete, status: "idle" as const },
          ]),
        ),
      );
    },
    [category],
  );

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function handleSave(entryId: number) {
    const row = rows[entryId];
    if (!row) return;
    const score = Number(row.score);
    if (row.score.trim() === "" || Number.isNaN(score) || score < 0) {
      setRows((prev) => ({ ...prev, [entryId]: { ...prev[entryId], status: "error" } }));
      return;
    }

    setRows((prev) => ({ ...prev, [entryId]: { ...prev[entryId], status: "saving" } }));
    const response = await fetch(`/api/admin/scoring/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score, scoringComplete: row.scoringComplete }),
    });
    setRows((prev) => ({ ...prev, [entryId]: { ...prev[entryId], status: response.ok ? "saved" : "error" } }));
  }

  return (
    <div>
      <label className="fieldset-label mb-4 flex-col items-start">
        <span className="text-xs">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category | "")}
          className="select select-sm w-48"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div role="alert" className="alert alert-error alert-soft mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Registration #</th>
              <th>Participant</th>
              <th>Title</th>
              <th>Medium</th>
              <th>Score</th>
              <th>Complete</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {entries?.map((entry) => {
              const row = rows[entry.entryId];
              if (!row) return null;
              return (
                <tr key={entry.entryId}>
                  <td>{entry.category}</td>
                  <td>{entry.registrationNumber}</td>
                  <td>{entry.participantName}</td>
                  <td>{entry.title}</td>
                  <td>{entry.medium}</td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={row.score}
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [entry.entryId]: { ...prev[entry.entryId], score: e.target.value, status: "idle" },
                        }))
                      }
                      className="input input-sm w-24"
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={row.scoringComplete}
                      onChange={(e) =>
                        setRows((prev) => ({
                          ...prev,
                          [entry.entryId]: { ...prev[entry.entryId], scoringComplete: e.target.checked, status: "idle" },
                        }))
                      }
                      className="checkbox checkbox-sm"
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => handleSave(entry.entryId)} className="btn btn-primary btn-xs">
                      {row.status === "saving" ? "Saving…" : "Save"}
                    </button>
                    {row.status === "saved" && <span className="text-success ml-2 text-xs">Saved</span>}
                    {row.status === "error" && <span className="text-error ml-2 text-xs">Enter a valid score</span>}
                  </td>
                </tr>
              );
            })}
            {entries && entries.length === 0 && (
              <tr>
                <td colSpan={8} className="text-base-content/60 text-center">
                  No eligible entries with a valid file yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
