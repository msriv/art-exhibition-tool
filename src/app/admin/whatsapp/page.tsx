import Link from "next/link";
import { WhatsAppPanel } from "@/components/admin/whatsapp-panel";

export default function AdminWhatsAppPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin" className="link link-primary text-sm">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">WhatsApp updates</h1>
      <p className="text-base-content/70 mt-1 text-sm">
        Ready-made message text per stage, copied and sent by hand via WhatsApp Web/app. Nothing here sends a
        message automatically — marking a stage &quot;sent&quot; just records that you did, and when.
      </p>
      <div className="mt-6">
        <WhatsAppPanel />
      </div>
    </div>
  );
}
