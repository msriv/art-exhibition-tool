"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_FEES,
  calculateAge,
  categoryForAge,
  computeExpectedAmountPaise,
  formatRupees,
  type CompetitiveCategory,
} from "@/config/fees";
import type { CategoryRegistrationPayload } from "@/lib/register-types";
import { UploadNotAvailableError, uploadFile } from "@/lib/upload";
import { DoodleUnderline } from "@/components/ui/doodles";
import { emptyPaintingDraft, PaintingFields, type PaintingDraft } from "./painting-fields";

type Props = {
  ageCutoffDate: string;
  organizerUpiId: string;
};

type SubmitState = { status: "idle" | "working" | "error" | "done"; message?: string };

export function CategoryForm({ ageCutoffDate, organizerUpiId }: Props) {
  const [category, setCategory] = useState<CompetitiveCategory | "">("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [consentParticipant, setConsentParticipant] = useState(false);
  const [consentGuardian, setConsentGuardian] = useState(false);
  const [artistPhoto, setArtistPhoto] = useState<File | null>(null);
  const [paintings, setPaintings] = useState<PaintingDraft[]>([emptyPaintingDraft()]);
  const [declaredRupees, setDeclaredRupees] = useState<string>("");
  const [upiReference, setUpiReference] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const feeConfig = category ? CATEGORY_FEES[category] : null;

  // Non-blocking UX hint only — the real age-vs-category check (§8.1) runs
  // server-side once milestone 8 exists, against whatever the true cutoff
  // date is at submission time, not this snapshot.
  const ageHint = useMemo(() => {
    if (!dob) return null;
    const age = calculateAge(dob, ageCutoffDate);
    const matched = categoryForAge(dob, ageCutoffDate);
    return { age, matched };
  }, [dob, ageCutoffDate]);

  const isMinor = ageHint !== null && ageHint.age < 18;
  const expectedAmountPaise = category ? computeExpectedAmountPaise(category, 1) : 0;

  function updatePainting(index: number, patch: Partial<PaintingDraft>) {
    setPaintings((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category) return;
    if (!consentParticipant) {
      setSubmit({ status: "error", message: "Participant consent is required." });
      return;
    }
    if (isMinor && !consentGuardian) {
      setSubmit({ status: "error", message: "Guardian consent is required for entrants under 18." });
      return;
    }
    if (!artistPhoto || !paymentScreenshot) {
      setSubmit({ status: "error", message: "Photo and payment screenshot are both required." });
      return;
    }
    if (paintings.some((p) => !p.title || !p.medium || !p.file)) {
      setSubmit({ status: "error", message: "Every painting needs a title, medium, and file." });
      return;
    }

    setSubmit({ status: "working", message: "Uploading files…" });
    try {
      const artistPhotoUrl = await uploadFile(artistPhoto, "artist_photo");
      const paintingUploads = await Promise.all(
        paintings.map(async (p) => ({
          title: p.title,
          medium: p.medium,
          fileUrl: await uploadFile(p.file as File, "artwork"),
        })),
      );
      const paymentScreenshotUrl = await uploadFile(paymentScreenshot, "payment_screenshot");

      const declaredAmountPaise = Math.round(parseFloat(declaredRupees || "0") * 100);
      const payload: CategoryRegistrationPayload = {
        category,
        name,
        dob,
        mobile,
        email,
        consentParticipant: true,
        consentGuardian: isMinor ? consentGuardian : undefined,
        artistPhotoUrl,
        paintings: paintingUploads,
        payment: { declaredAmountPaise, upiReference, paymentScreenshotUrl },
      };

      setSubmit({ status: "working", message: "Submitting registration…" });
      const response = await fetch("/api/register/category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        setSubmit({ status: "error", message: "Something went wrong on our end — please try again." });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSubmit({ status: "error", message: body?.error ?? "Registration failed." });
        return;
      }

      setSubmit({ status: "done" });
    } catch (err) {
      const message =
        err instanceof UploadNotAvailableError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Something went wrong.";
      setSubmit({ status: "error", message });
    }
  }

  if (submit.status === "done") {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold">Registration submitted</h1>
        <p className="text-base-content/70 mt-2">
          You&apos;ll receive your registration number once it&apos;s confirmed.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Category Sign-Up</h1>
      <DoodleUnderline className="text-primary mt-1 h-2.5 w-28" />

      <fieldset className="fieldset mt-6">
        <legend className="fieldset-legend">Category</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(Object.keys(CATEGORY_FEES) as CompetitiveCategory[]).map((key) => {
            const cfg = CATEGORY_FEES[key];
            return (
              <label
                key={key}
                className={`card card-border cursor-pointer p-3 text-sm ${
                  category === key ? "border-primary bg-primary/10" : "bg-base-100"
                }`}
              >
                <input
                  type="radio"
                  name="category"
                  value={key}
                  checked={category === key}
                  onChange={() => {
                    setCategory(key);
                    setPaintings((prev) => prev.slice(0, cfg.maxEntries));
                  }}
                  className="sr-only"
                  required
                />
                <div className="font-medium">Category {key}</div>
                <div className="text-base-content/70">
                  Ages {cfg.ageBand.minAge}
                  {cfg.ageBand.maxAge ? `–${cfg.ageBand.maxAge}` : "+"} · {formatRupees(cfg.feePaise)}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="fieldset-label flex-col items-start">
          Full name
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="fieldset-label flex-col items-start">
          Date of birth
          <input
            type="date"
            required
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="input w-full"
          />
          {ageHint && (
            <span className="text-base-content/60 text-xs">
              Age {ageHint.age} as of the event cutoff
              {ageHint.matched && ageHint.matched !== category
                ? ` — looks like Category ${ageHint.matched}, not ${category || "the one selected"}`
                : ""}
              . The organizer confirms this at review.
            </span>
          )}
        </label>
        <label className="fieldset-label flex-col items-start">
          Mobile number
          <input
            type="tel"
            required
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="input w-full"
          />
        </label>
        <label className="fieldset-label flex-col items-start">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input w-full"
          />
        </label>
      </div>

      <label className="fieldset-label mt-4">
        <input
          type="checkbox"
          required
          checked={consentParticipant}
          onChange={(e) => setConsentParticipant(e.target.checked)}
          className="checkbox checkbox-sm"
        />
        I confirm the details above are accurate and I consent to participate.
      </label>

      {isMinor && (
        <label className="fieldset-label mt-1">
          <input
            type="checkbox"
            checked={consentGuardian}
            onChange={(e) => setConsentGuardian(e.target.checked)}
            className="checkbox checkbox-sm"
          />
          I am this entrant&apos;s parent/guardian and I consent to their participation.
        </label>
      )}

      <label className="fieldset-label mt-6 flex-col items-start">
        Your photo (for the I-Card)
        <input
          type="file"
          required
          accept="image/*"
          onChange={(e) => setArtistPhoto(e.target.files?.[0] ?? null)}
          className="file-input w-full"
        />
      </label>

      <div className="mt-6 flex flex-col gap-4">
        <h2 className="text-sm font-medium">
          Artwork {feeConfig && `(up to ${feeConfig.maxEntries})`}
        </h2>
        {paintings.map((p, i) => (
          <PaintingFields
            key={i}
            index={i}
            value={p}
            onChange={(patch) => updatePainting(i, patch)}
            onRemove={paintings.length > 1 ? () => setPaintings((prev) => prev.filter((_, j) => j !== i)) : undefined}
            mediumOptions={feeConfig?.mediums}
          />
        ))}
        {feeConfig && paintings.length < feeConfig.maxEntries && (
          <button
            type="button"
            onClick={() => setPaintings((prev) => [...prev, emptyPaintingDraft()])}
            className="btn btn-outline btn-sm self-start"
          >
            + Add another painting
          </button>
        )}
      </div>

      <div className="card bg-base-200 mt-8">
        <div className="card-body">
          <h2 className="card-title text-sm">Payment (UPI only)</h2>
          {category && (
            <p className="text-base-content/70 text-sm">
              Pay {formatRupees(expectedAmountPaise)} to <strong>{organizerUpiId}</strong>, then fill in
              the details below.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="fieldset-label flex-col items-start">
              Amount paid (₹)
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={declaredRupees}
                onChange={(e) => setDeclaredRupees(e.target.value)}
                placeholder={category ? String(expectedAmountPaise / 100) : undefined}
                className="input w-full"
              />
            </label>
            <label className="fieldset-label flex-col items-start">
              UPI reference number
              <input
                type="text"
                required
                value={upiReference}
                onChange={(e) => setUpiReference(e.target.value)}
                className="input w-full"
              />
            </label>
          </div>
          <label className="fieldset-label flex-col items-start">
            Payment screenshot
            <input
              type="file"
              required
              accept="image/*"
              onChange={(e) => setPaymentScreenshot(e.target.files?.[0] ?? null)}
              className="file-input w-full"
            />
          </label>
        </div>
      </div>

      {submit.status === "error" && (
        <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
          <span>{submit.message}</span>
        </div>
      )}

      <button type="submit" disabled={submit.status === "working"} className="btn btn-primary mt-6">
        {submit.status === "working" && <span className="loading loading-spinner loading-sm" />}
        {submit.status === "working" ? (submit.message ?? "Submitting…") : "Submit registration"}
      </button>
    </form>
  );
}
