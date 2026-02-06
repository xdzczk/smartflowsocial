import { Link, useLocation, useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { clearAllClientCacheOnLogout } from "~/lib/clear-client-cache.client";
import { clearActiveSignerConfig } from "~/lib/nostr-signer-manager.client";
import { useOptionalUser } from "~/lib/remix-utils";
import { setCurrentUserNpub } from "~/lib/remote-signer-sessions.client";
// ============================================================================
// Helper Functions
// ============================================================================

/** Normalize nostrProfile to object (root loader can pass it as object or JSON string) */
function getNostrProfileObject(user: unknown): Record<string, unknown> | null {
  if (typeof user !== "object" || user === null || !("nostrProfile" in user)) {
    return null;
  }
  const raw = (user as { nostrProfile?: unknown }).nostrProfile;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function getUserProfilePicture(user: unknown): string | undefined {
  const p = getNostrProfileObject(user);
  if (
    p &&
    "picture" in p &&
    typeof p["picture"] === "string" &&
    p["picture"].trim()
  ) {
    return p["picture"];
  }
  return undefined;
}

function getUserDisplayName(user: unknown): string {
  const p = getNostrProfileObject(user);
  if (p) {
    if (typeof p["name"] === "string" && p["name"].trim()) {
      return p["name"].trim();
    }
    if (typeof p["display_name"] === "string" && p["display_name"].trim()) {
      return p["display_name"].trim();
    }
  }
  if (
    typeof user === "object" &&
    user !== null &&
    "npub" in user &&
    user.npub
  ) {
    const npub = String(user.npub);
    // If it looks like a hex pubkey (64 hex chars), show a short label instead of raw hex
    if (/^[0-9a-fA-F]{64}$/.test(npub)) {
      return "Account";
    }
    return `${npub.slice(0, 12)}...${npub.slice(-8)}`;
  }
  return "";
}

function getUserAvatarFallback(user: unknown): string {
  const p = getNostrProfileObject(user);
  if (p) {
    if (typeof p["name"] === "string" && p["name"].trim()) {
      return p["name"].trim()[0] ?? "U";
    }
    if (typeof p["display_name"] === "string" && p["display_name"].trim()) {
      return p["display_name"].trim()[0] ?? "U";
    }
  }
  if (
    typeof user === "object" &&
    user !== null &&
    "npub" in user &&
    typeof (user as { npub: string }).npub === "string"
  ) {
    const npub = (user as { npub: string }).npub;
    if (/^[0-9a-fA-F]{64}$/.test(npub)) return "A";
  }
  return "U";
}

export default function NostrAuthButton() {
  const user = useOptionalUser() ?? null;
  const location = useLocation();
  const queryClient = useQueryClient();
  const logoutFetcher = useFetcher();
  const hasReloadedRef = useRef(false);
  const wasSubmittingRef = useRef(false);

  const isLoginPage = location.pathname.startsWith("/login");

  // Handle logout redirect - force full page reload to clear all state
  // Must be before early return to comply with Rules of Hooks
  useEffect(() => {
    // Track when fetcher transitions from submitting to idle (logout completed)
    if (logoutFetcher.state === "submitting") {
      wasSubmittingRef.current = true;
    } else if (
      logoutFetcher.state === "idle" &&
      wasSubmittingRef.current &&
      !hasReloadedRef.current
    ) {
      hasReloadedRef.current = true;
      wasSubmittingRef.current = false;
      // Clear all client-side state so no account A data can leak into account B session
      clearActiveSignerConfig();
      setCurrentUserNpub(null);
      clearAllClientCacheOnLogout();
      queryClient.clear();
      // Force full page reload to ensure all Remix loader data is fresh
      window.location.href = "/";
    }
  }, [logoutFetcher.state, queryClient]);

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
            {location.pathname === "/" ||
            location.pathname.startsWith("/plans") ? (
              <Button
                variant="default"
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                asChild
              >
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
          className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-ring inline-flex items-center justify-center gap-2 rounded-lg px-8 py-4 text-lg font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none"
          asChild
        >
          <Link to="/login">Sign in</Link>
        </Button>
      )}
    </>
  );
}
