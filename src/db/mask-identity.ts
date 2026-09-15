import "server-only";

/**
 * Masks PII for display in the lookup/match confirmation flows
 * (src/lib/register-lookup-types.ts). These are the only forms of a
 * participant's name/mobile/email a public, unauthenticated route may ever
 * return — see the rationale there and in the README's "Participation
 * form" section: a registration number is sequentially guessable, so
 * returning full values would let anyone enumerate every participant's
 * contact details.
 */

/** "John Smith" -> "J*** S***". Each word keeps its first letter only. */
export function maskName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word.length <= 1 ? word : `${word[0]}${"*".repeat(Math.min(word.length - 1, 3))}`))
    .join(" ");
}

/** "9876543210" -> "98••••••10". Keeps the first two and last two digits. */
export function maskMobile(mobile: string): string {
  const digits = mobile.trim();
  if (digits.length <= 4) return "•".repeat(digits.length);
  return `${digits.slice(0, 2)}${"•".repeat(digits.length - 4)}${digits.slice(-2)}`;
}

/** "test@example.com" -> "t***@e***.com". Keeps the first letter of the local part and domain. */
export function maskEmail(email: string): string {
  const [local, domain] = email.trim().split("@");
  if (!domain) return maskName(email);

  const maskedLocal = local.length <= 1 ? local : `${local[0]}${"*".repeat(Math.min(local.length - 1, 3))}`;

  const domainParts = domain.split(".");
  const domainName = domainParts[0] ?? "";
  const tld = domainParts.slice(1).join(".");
  const maskedDomainName =
    domainName.length <= 1 ? domainName : `${domainName[0]}${"*".repeat(Math.min(domainName.length - 1, 3))}`;

  return `${maskedLocal}@${maskedDomainName}${tld ? `.${tld}` : ""}`;
}

export type MaskedIdentityFields = { maskedName: string; maskedMobile: string; maskedEmail: string };

export function maskIdentity(fields: { name: string; mobile: string; email: string }): MaskedIdentityFields {
  return {
    maskedName: maskName(fields.name),
    maskedMobile: maskMobile(fields.mobile),
    maskedEmail: maskEmail(fields.email),
  };
}
