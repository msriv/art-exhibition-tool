"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { AdminResourceMeta, ColumnConfig } from "@/config/admin-resources";
import { formatRupees } from "@/config/fees";

type ListResponse = { rows: Record<string, unknown>[]; total: number; page: number; pageSize: number };

/**
 * The one list view every resource shares (§15) — search, per-column
 * filters, sortable headers, and pagination, all driven by a resource's
 * ColumnConfig rather than five bespoke table components.
 */
export function ResourceTable({ meta }: { meta: AdminResourceMeta }) {
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState(meta.defaultSort.key);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(meta.defaultSort.direction);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [data, setData] = useState<ListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const listColumns = meta.columns.filter((c) => c.showInList);
  const filterableColumns = meta.columns.filter((c) => c.filterable);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const params = new URLSearchParams({
        page: String(page),
        sort: sortKey,
        dir: sortDirection,
      });
      if (search) params.set("q", search);
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value);
      }

      const response = await fetch(`/api/admin/${meta.slug}?${params.toString()}`, { signal });
      if (signal?.aborted) return;
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Could not load records.");
        return;
      }
      const json = (await response.json()) as ListResponse;
      if (signal?.aborted) return;
      setError(null);
      setData(json);
    },
    [meta.slug, page, sortKey, sortDirection, search, filters],
  );

  useEffect(() => {
    // Next's current guidance is `use()` + Suspense, or a library like SWR,
    // over fetch-in-effect for Client Components — sound for data that's
    // static per navigation. This isn't: it has to re-run whenever
    // search/filters/sort/page (client-only state) change, which is
    // exactly what an effect is for. Cancels the in-flight request on
    // rapid changes via the abort signal, checked before either setState
    // call in `load`.
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
    setPage(1);
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        {meta.searchableColumns && meta.searchableColumns.length > 0 && (
          <label className="fieldset-label flex-col items-start">
            <span className="text-xs">Search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search…"
              className="input input-sm w-48"
            />
          </label>
        )}
        {filterableColumns.map((column) => (
          <label key={column.key} className="fieldset-label flex-col items-start">
            <span className="text-xs">{column.label}</span>
            <select
              value={filters[column.key] ?? ""}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, [column.key]: e.target.value }));
                setPage(1);
              }}
              className="select select-sm w-40"
            >
              <option value="">All</option>
              {column.enumValues?.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        ))}
        <Link href={`/admin/${meta.slug}/new`} className="btn btn-primary btn-sm ml-auto">
          + New
        </Link>
      </div>

      {error && (
        <div role="alert" className="alert alert-error alert-soft mb-4 text-sm">
          <span>{error}</span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              {listColumns.map((column) => (
                <th key={column.key}>
                  {column.sortable ? (
                    <button type="button" onClick={() => toggleSort(column.key)} className="flex items-center gap-1">
                      {column.label}
                      {sortKey === column.key && <span>{sortDirection === "asc" ? "▲" : "▼"}</span>}
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.rows.map((row) => (
              <tr key={String(row.id)} className="hover:bg-base-200">
                {listColumns.map((column) => (
                  <td key={column.key}>
                    <Link href={`/admin/${meta.slug}/${row.id}`} className="block">
                      {formatCellValue(column, row[column.key])}
                    </Link>
                  </td>
                ))}
              </tr>
            ))}
            {data && data.rows.length === 0 && (
              <tr>
                <td colSpan={listColumns.length} className="text-base-content/60 text-center">
                  No records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-base-content/60">{data.total} total</span>
          <div className="join">
            <button
              type="button"
              className="join-item btn btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              «
            </button>
            <span className="join-item btn btn-sm btn-disabled">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="join-item btn btn-sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCellValue(column: ColumnConfig, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (column.type === "currency" && typeof value === "number") return formatRupees(value);
  if (column.type === "datetime") return new Date(value as string).toLocaleString();
  if (column.type === "boolean") return value ? "Yes" : "No";
  return String(value);
}
