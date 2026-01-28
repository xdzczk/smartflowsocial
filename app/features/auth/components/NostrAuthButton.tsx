import { Link, useLocation, useRevalidator } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { clearActiveSignerConfig } from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
// ============================================================================
// Helper Functions
// ============================================================================

function getUserProfilePicture(user: unknown): string | undefined {
  if (
    typeof user === "object" &&
    user !== null &&
    "nostrProfile" in user &&
    typeof user.nostrProfile === "object" &&
    user.nostrProfile !== null &&
    "picture" in user.nostrProfile
  ) {
    return String(user.nostrProfile["picture"]);
  }
  return undefined;
}

function getUserDisplayName(user: unknown): string {
  if (
    typeof user === "object" &&
    user !== null &&
    "nostrProfile" in user &&
    typeof user.nostrProfile === "object" &&
    user.nostrProfile !== null
  ) {
    if ("name" in user.nostrProfile && user.nostrProfile["name"]) {
      return String(user.nostrProfile["name"]);
    }
    if (
      "display_name" in user.nostrProfile &&
      user.nostrProfile["display_name"]
    ) {
      return String(user.nostrProfile["display_name"]);
    }
  }

  if (
    typeof user === "object" &&
    user !== null &&
    "npub" in user &&
    user.npub
  ) {
    const npub = String(user.npub);
    return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
  }

  return "";
}

function getUserAvatarFallback(user: unknown): string {
  if (
    typeof user === "object" &&
    user !== null &&
    "nostrProfile" in user &&
    typeof user.nostrProfile === "object" &&
    user.nostrProfile !== null
  ) {
    if ("name" in user.nostrProfile && user.nostrProfile["name"]) {
      return String(user.nostrProfile["name"])[0] ?? "U";
    }
    if (
      "display_name" in user.nostrProfile &&
      user.nostrProfile["display_name"]
    ) {
      return String(user.nostrProfile["display_name"])[0] ?? "U";
    }
  }
  return "U";
}

export default function NostrAuthButton() {
  const user = useOptionalUser() ?? null;
  const location = useLocation();
  const queryClient = useQueryClient();
  const revalidator = useRevalidator();

  // Always land in the app after sign-in (not back on marketing pages).
  const redirectTo = useMemo(() => encodeURIComponent("/dashboard"), []);

  const isLoginPage = location.pathname.startsWith("/login");

  // Avoid rendering a redundant "Sign in" CTA on the login page itself.
  if (!user && isLoginPage) return null;

  return (
    <>
      {user ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={getUserProfilePicture(user)} alt="Profile" />
              <AvatarFallback>{getUserAvatarFallback(user)}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{getUserDisplayName(user)}</span>
            {location.pathname === "/" ? (
              <Button variant="outline" size="sm" asChild>
                <Link to="/dashboard">Dashboard</Link>
              </Button>
            ) : null}
            <form
              action="/logout"
              method="post"
              onSubmit={() => {
                // Clear client-side state before logout
                clearActiveSignerConfig();
                // Clear React Query cache to prevent stale data
                queryClient.clear();
                // Revalidate all loaders to ensure fresh data after redirect
                revalidator.revalidate();
              }}
            >
              <Button variant="outline" size="sm" type="submit">
                Logout
              </Button>
            </form>
          </div>
        </>
      ) : (
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-lg font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          asChild
        >
          <Link to={`/login?redirectTo=${redirectTo}`}>Sign in</Link>
        </Button>
      )}
    </>
  );
}
