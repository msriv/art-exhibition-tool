"use client";

import { useState } from "react";
import { computeExpectedAmountPaise, formatRupees, PARTICIPATION_MAX_ENTRIES } from "@/config/fees";
import type { ParticipationRegistrationPayload } from "@/lib/register-types";
import { UploadNotAvailableError, uploadFile } from "@/lib/upload";
import { emptyPaintingDraft, PaintingFields, type PaintingDraft } from "./painting-fields";

type Props = {
  organizerUpiId: string;
};

type SubmitState = { status: "idle" | "working" | "error" | "done"; message?: string };

/**
 * No photo, no dob, no category here — per §6, a Participation submission
 * only adds `entries` rows to a participant who already exists from an
 * earlier Category submission (see README's "Organizer allow-list" section
 * for the parallel note on registration_number issuance). An unrecognized
 * registration number is rejected server-side once milestone 6 exists.
 */
export function ParticipationForm({ organizerUpiId }: Props) {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [paintings, setPaintings] = useState<PaintingDraft[]>([emptyPaintingDraft()]);
  const [declaredRupees, setDeclaredRupees] = useState("");
  const [upiReference, setUpiReference] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const expectedAmountPaise = computeExpectedAmountPaise("participation", paintings.length);

  function updatePainting(index: number, patch: Partial<PaintingDraft>) {
    setPaintings((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!registrationNumber.trim()) {
      setSubmit({ status: "error", message: "Registration number is required." });
      return;
    }
    if (!paymentScreenshot) {
      setSubmit({ status: "error", message: "Payment screenshot is required." });
      return;
    }
    if (paintings.some((p) => !p.title || !p.medium || !p.file)) {
      setSubmit({ status: "error", message: "Every painting needs a title, medium, and file." });
      return;
    }

    setSubmit({ status: "working", message: "Uploading files…" });
    try {
      const paintingUploads = await Promise.all(
        paintings.map(async (p) => ({
          title: p.title,
          medium: p.medium,
          fileUrl: await uploadFile(p.file as File, "artwork"),
        })),
      );
      const paymentScreenshotUrl = await uploadFile(paymentScreenshot, "payment_screenshot");

      const declaredAmountPaise = Math.round(parseFloat(declaredRupees || "0") * 100);
      const payload: ParticipationRegistrationPayload = {
        registrationNumber: registrationNumber.trim(),
        paintings: paintingUploads,
        payment: { declaredAmountPaise, upiReference, paymentScreenshotUrl },
      };

      setSubmit({ status: "working", message: "Submitting…" });
      const response = await fetch("/api/register/participation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        setSubmit({
          status: "error",
          message: "Registration isn't live yet — this endpoint hasn't been built (milestone 6).",
        });
        return;
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setSubmit({ status: "error", message: body?.error ?? "Submission failed." });
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
        <h1 className="text-xl font-semibold">Submission received</h1>
        <p className="text-base-content/70 mt-2">Your paintings have been added to your registration.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Participation-Only Sign-Up</h1>
      <p className="text-base-content/70 mt-2 text-sm">
        This adds paintings to an existing registration. Haven&apos;t registered yet?{" "}
        <a href="/register?form=category" className="link link-primary">
          Use the Category form
        </a>{" "}
        first to get a registration number.
      </p>

      <label className="fieldset-label mt-6 flex-col items-start">
        Registration number
        <input
          type="text"
          required
          value={registrationNumber}
          onChange={(e) => setRegistrationNumber(e.target.value)}
          placeholder="e.g. C2-00147"
          className="input w-full"
        />
      </label>

      <div className="mt-6 flex flex-col gap-4">
        <h2 className="text-sm font-medium">
          Paintings ({formatRupees(9_900)} each, up to {PARTICIPATION_MAX_ENTRIES})
        </h2>
        {paintings.map((p, i) => (
          <PaintingFields
            key={i}
            index={i}
            value={p}
            onChange={(patch) => updatePainting(i, patch)}
            onRemove={paintings.length > 1 ? () => setPaintings((prev) => prev.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        {paintings.length < PARTICIPATION_MAX_ENTRIES && (
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
          <p className="text-base-content/70 text-sm">
            Pay {formatRupees(expectedAmountPaise)} to <strong>{organizerUpiId}</strong>, then fill in
            the details below.
          </p>
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
                placeholder={String(expectedAmountPaise / 100)}
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
        {submit.status === "working" ? (submit.message ?? "Submitting…") : "Submit"}
      </button>
    </form>
  );
}
