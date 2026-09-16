import Link from "next/link";
import { formatRupees } from "@/config/fees";

type Entry = {
  id: number;
  title: string;
  medium: string;
  fileStatus: string;
  score: { score: number; scoringComplete: boolean } | null;
};
type ArtistPhoto = { id: number; fileUrl: string; fileStatus: string };
type Payment = {
  id: number;
  declaredAmount: number;
  expectedAmount: number;
  feeMatch: boolean;
  verificationStatus: string;
};

/**
 * §15's "see their full record joined across payments, entries, artist
 * photo, and scores" — separate read-only summaries below the editable
 * participant form, each row linking to that specific record's own editor
 * rather than trying to edit everything from one giant form.
 */
export function RelatedParticipantData({ related }: { related: Record<string, unknown> }) {
  const entries = (related.entries as Entry[]) ?? [];
  const artistPhotos = (related.artistPhotos as ArtistPhoto[]) ?? [];
  const payments = (related.payments as Payment[]) ?? [];

  return (
    <div className="mt-10 flex flex-col gap-6">
      <section>
        <h2 className="text-sm font-medium">Entries ({entries.length})</h2>
        {entries.length === 0 ? (
          <p className="text-base-content/60 mt-1 text-sm">None.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Link href={`/admin/entries/${entry.id}`} className="link link-primary text-sm">
                  {entry.title} ({entry.medium}) — {entry.fileStatus}
                  {entry.score && ` — score ${entry.score.score}${entry.score.scoringComplete ? "" : " (in progress)"}`}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium">Artist photo</h2>
        {artistPhotos.length === 0 ? (
          <p className="text-base-content/60 mt-1 text-sm">None.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {artistPhotos.map((photo) => (
              <li key={photo.id}>
                <Link href={`/admin/artist-photos/${photo.id}`} className="link link-primary text-sm">
                  {photo.fileUrl} — {photo.fileStatus}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium">Payments ({payments.length})</h2>
        {payments.length === 0 ? (
          <p className="text-base-content/60 mt-1 text-sm">None.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {payments.map((payment) => (
              <li key={payment.id}>
                <Link href={`/admin/payments/${payment.id}`} className="link link-primary text-sm">
                  {formatRupees(payment.declaredAmount)} of {formatRupees(payment.expectedAmount)} —{" "}
                  {payment.verificationStatus}
                  {!payment.feeMatch && " (fee mismatch)"}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
