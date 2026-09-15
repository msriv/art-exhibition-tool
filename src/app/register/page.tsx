import { getAgeCutoffDate, getOrganizerUpiId } from "@/db/settings";
import { CategoryForm } from "@/components/register/category-form";
import { ChooseEntryType } from "@/components/register/choose-entry-type";
import { ParticipationForm } from "@/components/register/participation-form";

/**
 * Both public sign-up forms, served from one route selected by a `form`
 * query param (§3) rather than two hardcoded pages — so a third form later
 * is a new `case`, not a new route, and the URL stays simple to share.
 *
 * `form` is validated against a known allow-list here, server-side, rather
 * than trusted blindly: an unrecognized value falls back to the chooser
 * instead of erroring.
 */

const KNOWN_FORMS = new Set(["category", "participation"]);

type SearchParams = Promise<{ form?: string }>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const { form } = await searchParams;

  if (form && !KNOWN_FORMS.has(form)) {
    return <ChooseEntryType />;
  }

  if (form === "category" || form === "participation") {
    // Both forms need these on their payment step; fetched once here rather
    // than duplicated in each form component.
    const [ageCutoffDate, organizerUpiId] = await Promise.all([
      getAgeCutoffDate(),
      getOrganizerUpiId(),
    ]);

    return form === "category" ? (
      <CategoryForm ageCutoffDate={ageCutoffDate} organizerUpiId={organizerUpiId} />
    ) : (
      <ParticipationForm organizerUpiId={organizerUpiId} />
    );
  }

  return <ChooseEntryType />;
}
