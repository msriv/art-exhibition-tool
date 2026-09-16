"use client";

import { useState } from "react";
import type { ColumnConfig } from "@/config/admin-resources";
import { formatRupees } from "@/config/fees";

type Props = {
  columns: ColumnConfig[];
  /** "create" shows even read-only fields as editable — see module comment. */
  mode: "create" | "edit";
  initialValues: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  submitLabel: string;
};

/**
 * The one row-editor form every resource shares (§15) — rendered entirely
 * from a resource's ColumnConfig list, never hardcoded per table.
 *
 * "Read-only" is relative to mode: a value already assigned by the system
 * (registration_number, submitted_at, …) shows as plain text once a row
 * exists, protecting it from an accidental edit — but the same field is a
 * normal input while creating a new row, since nothing has assigned it yet
 * and some of these are NOT NULL columns a manually-created row still needs
 * a value for (§15's own example is a manually-entered payment; the same
 * logic applies to any resource).
 */
export function ResourceForm({ columns, mode, initialValues, onSubmit, submitLabel }: Props) {
  // A checkbox that's never clicked never fires onChange, so a NOT NULL
  // boolean column (e.g. consent_participant) would otherwise be missing
  // from the submitted values entirely on create, not just falsy —
  // coerceValues on the server treats "missing" as "leave the column out
  // of the insert," which fails the column's NOT NULL constraint instead
  // of writing `false`.
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    if (mode !== "create") return initialValues;
    const defaults: Record<string, unknown> = { ...initialValues };
    for (const column of columns) {
      if (column.type === "boolean" && !column.nullable && !(column.key in defaults)) {
        defaults[column.key] = false;
      }
    }
    return defaults;
  });
  const [status, setStatus] = useState<{ state: "idle" | "saving" | "saved" | "error"; message?: string }>({
    state: "idle",
  });

  function setField(key: string, value: unknown) {
    setValues((prev) => ({ ...prev, [key]: value }));
    // A "Saved" (or stale error) badge shouldn't keep showing once the
    // organizer has changed something since — it no longer describes what's
    // currently in the form.
    setStatus((prev) => (prev.state === "idle" || prev.state === "saving" ? prev : { state: "idle" }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus({ state: "saving" });
    try {
      await onSubmit(values);
      // Create navigates away immediately via router.push (see
      // NewResourceForm), so this only ever visibly matters for edit — but
      // it has to run either way, since onSubmit resolving successfully
      // is the only signal a save actually finished.
      setStatus({ state: "saved" });
    } catch (err) {
      setStatus({ state: "error", message: err instanceof Error ? err.message : "Something went wrong." });
    }
  }

  const fields = columns.filter((c) => c.key !== "id");

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {fields.map((column) => {
        const locked = column.readOnly && mode === "edit";
        const value = values[column.key];

        if (locked) {
          return (
            <div key={column.key} className="fieldset-label flex-col items-start">
              <span className="text-xs">{column.label}</span>
              <span className="text-base-content/70 text-sm">{formatDisplayValue(column, value)}</span>
            </div>
          );
        }

        return (
          <FieldInput
            key={column.key}
            column={column}
            value={value}
            onChange={(v) => setField(column.key, v)}
          />
        );
      })}

      {status.state === "error" && (
        <div role="alert" className="alert alert-error alert-soft text-sm">
          <span>{status.message}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={status.state === "saving"} className="btn btn-primary self-start">
          {status.state === "saving" && <span className="loading loading-spinner loading-sm" />}
          {status.state === "saving" ? "Saving…" : submitLabel}
        </button>
        {status.state === "saved" && <span className="text-success text-sm">Saved</span>}
      </div>
    </form>
  );
}

function formatDisplayValue(column: ColumnConfig, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.type === "currency" && typeof value === "number") return formatRupees(value);
  if (column.type === "datetime") return new Date(value as string).toLocaleString();
  if (column.type === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function toDateTimeLocal(value: unknown): string {
  if (!value) return "";
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function FieldInput({
  column,
  value,
  onChange,
}: {
  column: ColumnConfig;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const label = (
    <span className="text-xs">
      {column.label}
      {column.nullable && <span className="text-base-content/50"> (optional)</span>}
    </span>
  );

  if (column.type === "boolean") {
    return (
      <label className="fieldset-label">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          className="checkbox checkbox-sm"
        />
        {column.label}
      </label>
    );
  }

  if (column.type === "enum") {
    return (
      <label className="fieldset-label flex-col items-start">
        {label}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={!column.nullable}
          className="select w-full"
        >
          {column.nullable && <option value="">—</option>}
          {!column.nullable && !value && (
            <option value="" disabled>
              Select…
            </option>
          )}
          {column.enumValues?.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (column.type === "textarea") {
    return (
      <label className="fieldset-label flex-col items-start">
        {label}
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="textarea w-full"
          rows={3}
        />
      </label>
    );
  }

  if (column.type === "date") {
    return (
      <label className="fieldset-label flex-col items-start">
        {label}
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={!column.nullable}
          className="input w-full"
        />
      </label>
    );
  }

  if (column.type === "datetime") {
    return (
      <label className="fieldset-label flex-col items-start">
        {label}
        <input
          type="datetime-local"
          value={toDateTimeLocal(value)}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          className="input w-full"
        />
      </label>
    );
  }

  if (column.type === "number" || column.type === "currency") {
    // Currency is stored in paise; the form works in rupees for the human editing it.
    const displayValue =
      column.type === "currency" && typeof value === "number" ? value / 100 : ((value as number | string) ?? "");
    return (
      <label className="fieldset-label flex-col items-start">
        {label}
        {column.type === "currency" && <span className="text-base-content/50 text-xs">In rupees</span>}
        <input
          type="number"
          step={column.type === "currency" ? "0.01" : "any"}
          value={displayValue as number | string}
          onChange={(e) => {
            const parsed = e.target.value === "" ? null : Number(e.target.value);
            onChange(column.type === "currency" && parsed !== null ? Math.round(parsed * 100) : parsed);
          }}
          required={!column.nullable}
          className="input w-full"
        />
      </label>
    );
  }

  return (
    <label className="fieldset-label flex-col items-start">
      {label}
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        required={!column.nullable}
        className="input w-full"
      />
    </label>
  );
}
