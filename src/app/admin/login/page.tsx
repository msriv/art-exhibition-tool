import { PLATFORM_NAME } from "@/config/platform";
import { SignInButton } from "@/components/auth/sign-in-button";

export default function AdminLoginPage() {
  return (
    <div className="hero flex-1">
      <div className="hero-content text-center">
        <div className="card bg-base-200 w-full max-w-sm">
          <div className="card-body items-center">
            <h1 className="card-title">{PLATFORM_NAME}</h1>
            <p className="text-base-content/70 text-sm">
              Organizer sign-in. Only approved Google accounts can access this section.
            </p>
            <div className="card-actions mt-2">
              <SignInButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
