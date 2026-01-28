import { Link, useLocation, useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

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
  const logoutFetcher = useFetcher();
  const hasReloadedRef = useRef(false);

  // Always land in the app after sign-in (not back on marketing pages).
  const redirectTo = useMemo(() => encodeURIComponent("/dashboard"), []);

  const isLoginPage = location.pathname.startsWith("/login");

  // Handle logout redirect - force full page reload to clear all state
  // Must be before early return to comply with Rules of Hooks
  useEffect(() => {
    // When logout completes (idle after submitting), force full page reload
    const isLogoutComplete =
      logoutFetcher.state === "idle" &&
      typeof logoutFetcher.formAction === "string" &&
      logoutFetcher.formAction === "/logout" &&
      typeof logoutFetcher.formMethod === "string" &&
      logoutFetcher.formMethod === "POST";

    if (isLogoutComplete && !hasReloadedRef.current) {
      hasReloadedRef.current = true;
      // Clear all client-side state
      clearActiveSignerConfig();
      queryClient.clear();
      // Force full page reload to ensure all Remix loader data is fresh
      window.location.href = "/";
    }
  }, [
    logoutFetcher.state,
    logoutFetcher.formAction,
    logoutFetcher.formMethod,
    queryClient,
  ]);

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
            <logoutFetcher.Form action="/logout" method="post">
              <Button variant="outline" size="sm" type="submit">
                Logout
              </Button>
            </logoutFetcher.Form>
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
