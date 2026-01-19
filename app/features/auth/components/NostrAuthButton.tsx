import { Link, useLocation } from "@remix-run/react";
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

  const redirectTo = useMemo(() => {
    const current = `${location.pathname}${location.search}`;
    return encodeURIComponent(current);
  }, [location.pathname, location.search]);

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
                clearActiveSignerConfig();
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
          className="bg-gradient-to-r from-purple-500 to-indigo-600 font-bold text-white hover:from-purple-600 hover:to-indigo-700"
          size="lg"
          asChild
        >
          <Link to={`/login?redirectTo=${redirectTo}`}>Sign in</Link>
        </Button>
      )}
    </>
  );
}
