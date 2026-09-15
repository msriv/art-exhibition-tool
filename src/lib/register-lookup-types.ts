/**
 * Contracts for resolving a Participation submission's identity — a
 * distinct mechanism from §8.2's `duplicate_check`, which flags a possible
 * duplicate for organizer review after the fact. This resolves *before*
 * submission, and requires an explicit human confirmation before anything
 * is linked; nothing here ever merges silently.
 *
 * Neither endpoint exists yet (milestone 6). Real values never reach the
 * client — both return a masked preview only, since a registration number
 * is sequentially guessable (C2-00001, C2-00002, …) and §16 forbids public
 * routes from returning mobile numbers or emails. The true values are used
 * server-side at final submission; the client only ever holds a masked
 * preview plus (for the match path) an opaque token.
 */

export type MaskedIdentity = {
  maskedName: string;
  maskedMobile: string;
  maskedEmail: string;
};

/** POST /api/register/lookup — resolves a registration number the user typed in. */
export type LookupRequest = { registrationNumber: string };

export type LookupResponse = ({ found: true } & MaskedIdentity) | { found: false };

/**
 * POST /api/register/match — used only when no registration number was
 * given. Looks for an existing participant by name, email, or mobile.
 *
 * Tie-break for the rare case where email and mobile independently match
 * different existing participants: email wins (organizer's decision).
 *
 * `matchToken` is short-lived and opaque — it lets final submission
 * reference "the participant the user just confirmed" without the client
 * ever learning the actual registration number, and without a race between
 * the check and the submit resolving to different data.
 */
export type MatchRequest = { name: string; mobile: string; email: string };

export type MatchResponse =
  | ({ matched: true; matchToken: string } & MaskedIdentity)
  | { matched: false };
