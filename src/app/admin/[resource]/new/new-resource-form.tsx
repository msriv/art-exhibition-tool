"use client";

import { useRouter } from "next/navigation";
import type { ColumnConfig } from "@/config/admin-resources";
import { ResourceForm } from "@/components/admin/resource-form";

export function NewResourceForm({ slug, columns }: { slug: string; columns: ColumnConfig[] }) {
  const router = useRouter();

  async function handleCreate(values: Record<string, unknown>) {
    const response = await fetch(`/api/admin/${slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "Could not create the record.");
    }
    const created = (await response.json()) as { id: number };
    router.push(`/admin/${slug}/${created.id}`);
  }

  return (
    <ResourceForm
      columns={columns}
      mode="create"
      initialValues={{}}
      onSubmit={handleCreate}
      submitLabel="Create"
    />
  );
}
