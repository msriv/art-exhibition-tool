import Link from "next/link";
import { ScoringTable } from "@/components/admin/scoring-table";

export default function AdminScoringPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/admin" className="link link-primary text-sm">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Scoring</h1>
      <p className="text-base-content/70 mt-1 text-sm">
        One overall score per entry — Categories 1/2/3 only. An entry only appears once its participant is eligible
        and its file has passed the upload checks.
      </p>
      <div className="mt-6">
        <ScoringTable />
      </div>
    </div>
  );
}
