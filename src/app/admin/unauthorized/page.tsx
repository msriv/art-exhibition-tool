import { SignOutButton } from "@/components/auth/sign-out-button";

export default function AdminUnauthorizedPage() {
  return (
    <div className="hero flex-1">
      <div className="hero-content text-center">
        <div className="card bg-base-200 w-full max-w-sm">
          <div className="card-body items-center">
            <h1 className="card-title">Not an approved organizer</h1>
            <p className="text-base-content/70 text-sm">
              Your Google account signed in successfully, but it isn&apos;t on the
              organizer allow-list. Ask an existing organizer to add your email,
              or sign in with a different account.
            </p>
            <div className="card-actions mt-2">
              <SignOutButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
