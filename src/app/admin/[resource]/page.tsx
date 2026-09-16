import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminResourceMeta } from "@/config/admin-resources";
import { ResourceTable } from "@/components/admin/resource-table";

export default async function AdminResourceListPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource: slug } = await params;
  const meta = getAdminResourceMeta(slug);
  if (!meta) notFound();

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/admin" className="link link-primary text-sm">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">{meta.label}</h1>
      <div className="mt-6">
        <ResourceTable meta={meta} />
      </div>
    </div>
  );
}
