"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getAdminResourceMeta } from "@/config/admin-resources";
import { ResourceForm } from "@/components/admin/resource-form";
import { RelatedParticipantData } from "./related-participant-data";

type LoadState =
  | { state: "loading" }
  | { state: "not-found" }
  | { state: "error"; message: string }
  | { state: "ready"; row: Record<string, unknown> };

export default function AdminResourceEditPage() {
  const params = useParams<{ resource: string; id: string }>();
  const router = useRouter();
  const meta = getAdminResourceMeta(params.resource);
  const [load, setLoad] = useState<LoadState>({ state: "loading" });
  const [deleting, setDeleting] = useState(false);

  const fetchRow = useCallback(async () => {
    const response = await fetch(`/api/admin/${params.resource}/${params.id}`);
    if (response.status === 404) {
      setLoad({ state: "not-found" });
      return;
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setLoad({ state: "error", message: body?.error ?? "Could not load the record." });
      return;
    }
    setLoad({ state: "ready", row: await response.json() });
  }, [params.resource, params.id]);

  useEffect(() => {
    // Same reasoning as src/components/admin/resource-table.tsx: this has
    // to re-run when the route's [resource]/[id] params change, and again
    // after a mutation via the manual fetchRow() call in handleUpdate —
    // an effect is the right tool, not a one-shot promise from a parent
    // Server Component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRow();
  }, [fetchRow]);

  if (!meta) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <p className="text-error">Unknown resource.</p>
      </div>
    );
  }

  async function handleUpdate(values: Record<string, unknown>) {
    const response = await fetch(`/api/admin/${params.resource}/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Could not save the record.");
    }
    await fetchRow();
  }

  async function handleDelete() {
    if (!confirm(`Delete this ${meta!.label.replace(/s$/, "").toLowerCase()}? This can't be undone.`)) return;
    setDeleting(true);
    const response = await fetch(`/api/admin/${params.resource}/${params.id}`, { method: "DELETE" });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      alert(body?.error ?? "Could not delete the record.");
      setDeleting(false);
      return;
    }
    router.push(`/admin/${params.resource}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex items-center justify-between">
        <Link href={`/admin/${params.resource}`} className="link link-primary text-sm">
          ← {meta.label}
        </Link>
        <button type="button" onClick={handleDelete} disabled={deleting} className="btn btn-error btn-outline btn-sm">
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">
        {meta.label.replace(/s$/, "")} #{params.id}
      </h1>

      {load.state === "loading" && <p className="text-base-content/60 mt-6 text-sm">Loading…</p>}
      {load.state === "not-found" && <p className="text-error mt-6 text-sm">Not found.</p>}
      {load.state === "error" && <p className="text-error mt-6 text-sm">{load.message}</p>}

      {load.state === "ready" && (
        <>
          <div className="mt-6">
            <ResourceForm
              columns={meta.columns}
              mode="edit"
              initialValues={load.row}
              onSubmit={handleUpdate}
              submitLabel="Save changes"
            />
          </div>
          {params.resource === "participants" && "related" in load.row && (
            <RelatedParticipantData related={load.row.related as Record<string, unknown>} />
          )}
        </>
      )}
    </div>
  );
}
