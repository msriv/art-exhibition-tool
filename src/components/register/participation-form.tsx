"use client";

import { useState } from "react";
import { computeExpectedAmountPaise, formatRupees, PARTICIPATION_MAX_ENTRIES } from "@/config/fees";
import type { LookupResponse, MaskedIdentity, MatchResponse } from "@/lib/register-lookup-types";
import type { ParticipationRegistrationPayload } from "@/lib/register-types";
import { UploadNotAvailableError, uploadFile } from "@/lib/upload";
import { emptyPaintingDraft, PaintingFields, type PaintingDraft } from "./painting-fields";

type Props = {
  organizerUpiId: string;
};

type SubmitState = { status: "idle" | "working" | "error" | "done"; message?: string };

/**
 * Identity resolution is its own phase, gating the paintings/payment section
 * below it. Nothing here ever resolves silently — every path ends in either
 * an explicit human confirmation or a blocking error the person has to
 * clear themselves. See src/lib/register-lookup-types.ts for why the server
 * only ever returns masked previews, never real PII, from either check.
 */
type Resolution =
  | { kind: "unresolved" }
  | { kind: "checking" }
  | { kind: "foundById"; registrationNumber: string; masked: MaskedIdentity }
  | { kind: "notFoundById" }
  | { kind: "lookupUnavailable" }
  | { kind: "matchPending"; matchToken: string; masked: MaskedIdentity }
  | { kind: "matchConfirmed"; matchToken: string; masked: MaskedIdentity }
  | { kind: "matchUnavailable" }
  | { kind: "newRegistration" };

function MaskedPreview({ masked }: { masked: MaskedIdentity }) {
  return (
    <span>
      <strong>{masked.maskedName}</strong> · {masked.maskedMobile} · {masked.maskedEmail}
    </span>
  );
}

export function ParticipationForm({ organizerUpiId }: Props) {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [consentParticipant, setConsentParticipant] = useState(false);
  const [resolution, setResolution] = useState<Resolution>({ kind: "unresolved" });
  const [paintings, setPaintings] = useState<PaintingDraft[]>([emptyPaintingDraft()]);
  const [declaredRupees, setDeclaredRupees] = useState("");
  const [upiReference, setUpiReference] = useState("");
  const [paymentScreenshot, setPaymentScreenshot] = useState<File | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ status: "idle" });

  const expectedAmountPaise = computeExpectedAmountPaise("participation", paintings.length);
  const identityResolved =
    resolution.kind === "foundById" ||
    resolution.kind === "matchConfirmed" ||
    resolution.kind === "newRegistration";
  const identityLocked = resolution.kind === "foundById" || resolution.kind === "matchConfirmed";

  async function handleContinue() {
    if (!name.trim() || !mobile.trim() || !email.trim()) {
      setSubmit({ status: "error", message: "Name, mobile, and email are all required." });
      return;
    }
    if (!consentParticipant) {
      setSubmit({ status: "error", message: "Participant consent is required." });
      return;
    }
    setSubmit({ status: "idle" });
    setResolution({ kind: "checking" });

    const trimmedNumber = registrationNumber.trim();
    try {
      if (trimmedNumber) {
        // A typo'd number is a hard stop — never silently falls back to
        // matching by name/email/mobile instead.
        const response = await fetch("/api/register/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationNumber: trimmedNumber }),
        });
        if (response.status === 404) {
          setResolution({ kind: "lookupUnavailable" });
          return;
        }
        const body = (await response.json()) as LookupResponse;
        setResolution(
          body.found
            ? { kind: "foundById", registrationNumber: trimmedNumber, masked: body }
            : { kind: "notFoundById" },
        );
        return;
      }

      const response = await fetch("/api/register/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, mobile, email }),
      });
      if (response.status === 404) {
        // Blocks rather than silently treating this as "no match found" —
        // the whole point of this flow is never resolving identity without
        // an explicit choice. §8.2's organizer-facing duplicate_check flag
        // is still the eventual backstop, but the person has to actively
        // choose to proceed (button below), not have it happen for them.
        setResolution({ kind: "matchUnavailable" });
        return;
      }
      const body = (await response.json()) as MatchResponse;
      setResolution(
        body.matched
          ? { kind: "matchPending", matchToken: body.matchToken, masked: body }
          : { kind: "newRegistration" },
      );
    } catch {
      setResolution({ kind: "unresolved" });
      setSubmit({ status: "error", message: "Couldn't check that — please try again." });
    }
  }

  function editIdentity() {
    setResolution({ kind: "unresolved" });
  }

  function updatePainting(index: number, patch: Partial<PaintingDraft>) {
    setPaintings((prev) => prev.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        registrationNumber: resolution.kind === "foundById" ? resolution.registrationNumber : undefined,
        confirmedMatchToken: resolution.kind === "matchConfirmed" ? resolution.matchToken : undefined,
        name,
        mobile,
        email,
        consentParticipant: true,
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
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-xl font-semibold tracking-tight">Participation-Only Sign-Up</h1>
      <p className="text-base-content/70 mt-2 text-sm">
        Already registered? Enter your registration number below. First time entering?
        Leave it blank — we&apos;ll check for an existing registration before creating a
        new one.
      </p>

      <fieldset className="fieldset mt-6" disabled={identityLocked}>
        <label className="fieldset-label flex-col items-start">
          Registration number (optional)
          <input
            type="text"
            value={registrationNumber}
            onChange={(e) => {
              setRegistrationNumber(e.target.value);
              if (resolution.kind !== "unresolved") setResolution({ kind: "unresolved" });
            }}
            placeholder="e.g. C2-00147 — leave blank if you don't have one"
            className="input w-full"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
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
            Mobile number
            <input
              type="tel"
              required
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="input w-full"
            />
          </label>
          <label className="fieldset-label flex-col items-start sm:col-span-2">
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

        <label className="fieldset-label">
          <input
            type="checkbox"
            required
            checked={consentParticipant}
            onChange={(e) => setConsentParticipant(e.target.checked)}
            className="checkbox checkbox-sm"
          />
          I confirm the details above are accurate and I consent to participate.
        </label>
      </fieldset>

      {resolution.kind === "notFoundById" && (
        <div role="alert" className="alert alert-error alert-soft mt-3 text-sm">
          <span>
            We couldn&apos;t find that registration number. Please double-check it, or
            clear it to register as a new entrant.
          </span>
        </div>
      )}
      {resolution.kind === "lookupUnavailable" && (
        <div role="alert" className="alert alert-warning alert-soft mt-3 text-sm">
          <span>
            We can&apos;t verify registration numbers yet (milestone 6 isn&apos;t deployed).
            Clear the field to continue as a new registration, or try again later.
          </span>
        </div>
      )}
      {resolution.kind === "matchUnavailable" && (
        <div role="alert" className="alert alert-info alert-soft mt-3 flex-col items-start gap-2 text-sm">
          <span>Duplicate checking isn&apos;t live yet (milestone 6 isn&apos;t deployed).</span>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => setResolution({ kind: "newRegistration" })}
          >
            Continue as a new registration
          </button>
        </div>
      )}
      {resolution.kind === "matchPending" && (
        <div role="alert" className="alert alert-info alert-soft mt-3 flex-col items-start gap-2 text-sm">
          <span>
            We found an existing registration that looks like yours: <MaskedPreview masked={resolution.masked} />.
            Is this you?
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() =>
                setResolution({ kind: "matchConfirmed", matchToken: resolution.matchToken, masked: resolution.masked })
              }
            >
              Yes, link this
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => setResolution({ kind: "newRegistration" })}
            >
              No, this is new
            </button>
          </div>
        </div>
      )}
      {identityLocked && (
        <div className="alert alert-success alert-soft mt-3 flex items-center justify-between text-sm">
          <span>
            Linking to <MaskedPreview masked={resolution.masked} />.
          </span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={editIdentity}>
            Edit details
          </button>
        </div>
      )}

      {!identityResolved && (
        <button
          type="button"
          onClick={handleContinue}
          disabled={resolution.kind === "checking"}
          className="btn btn-primary mt-4"
        >
          {resolution.kind === "checking" && <span className="loading loading-spinner loading-sm" />}
          Continue
        </button>
      )}

      {identityResolved && (
        <form onSubmit={handleSubmit}>
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
                onRemove={
                  paintings.length > 1 ? () => setPaintings((prev) => prev.filter((_, j) => j !== i)) : undefined
                }
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
      )}

      {!identityResolved && submit.status === "error" && (
        <div role="alert" className="alert alert-error alert-soft mt-4 text-sm">
          <span>{submit.message}</span>
        </div>
      )}
    </div>
  );
}
