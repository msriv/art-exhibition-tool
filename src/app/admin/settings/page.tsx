import Link from "next/link";
import { SettingsForm } from "@/components/admin/settings-form";

export default function AdminSettingsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin" className="link link-primary text-sm">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Settings</h1>
      <p className="text-base-content/70 mt-1 text-sm">
        Organizer-editable config the sign-up forms depend on directly — a fresh database seeds these with
        non-functional placeholders, so replace both before opening registration for real.
      </p>
      <div className="mt-6">
        <SettingsForm />
      </div>
    </div>
  );
}
