import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminResourceMeta } from "@/config/admin-resources";
import { NewResourceForm } from "./new-resource-form";

export default async function AdminResourceNewPage({
  params,
}: {
  params: Promise<{ resource: string }>;
}) {
  const { resource: slug } = await params;
  const meta = getAdminResourceMeta(slug);
  if (!meta) notFound();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href={`/admin/${slug}`} className="link link-primary text-sm">
        ← {meta.label}
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">New {meta.label.replace(/s$/, "")}</h1>
      <p className="text-base-content/70 mt-1 text-sm">
        For edge cases the public forms don&apos;t cover — e.g. a payment taken over the phone (§15).
      </p>
      <div className="mt-6">
        <NewResourceForm slug={slug} columns={meta.columns} />
      </div>
    </div>
  );
}
