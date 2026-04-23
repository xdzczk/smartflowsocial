import { Link, useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { useEffect, useRef } from "react";
import * as React from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Separator } from "~/components/ui/separator";
import { clearActiveSignerConfig } from "~/features/auth/signer";
import type { ProfileData } from "~/features/nostr/types";
import { mapLegacyPlanIdToCommercialPlanType } from "~/features/payments/plan-mapping";
import { getCanonicalPlanPolicy } from "~/features/payments/plan-policy";
import { useSubscription } from "~/features/payments/types";
import { formatNpubShort } from "~/lib/nostr-conversion";
import { useOptionalUser } from "~/lib/remix-utils";

interface UserWithProfile {
  npub: string;
  nostrProfile?: ProfileData | null;
  [key: string]: unknown;
}

interface ChildAccount {
  npub: string;
  name?: string;
  displayName?: string;
  picture?: string;
}

// Helper functions from AccountSwitchMenu
function displayLabel(user: UserWithProfile | null | undefined): string {
  try {
    let p: ProfileData | null | undefined;
    if (typeof user?.nostrProfile === "string") {
      const parsed: unknown = JSON.parse(user.nostrProfile);
      p =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as ProfileData)
          : null;
    } else {
      p = user?.nostrProfile;
    }
    const name =
      p && typeof p === "object" && "name" in p && typeof p.name === "string"
        ? p.name
        : undefined;
    const displayName =
      p &&
      typeof p === "object" &&
      "display_name" in p &&
      typeof p.display_name === "string"
        ? p.display_name
        : undefined;
    return name ?? displayName ?? formatNpubShort(user?.npub);
  } catch {
    return formatNpubShort(user?.npub);
  }
}

function displayPicture(
  user: UserWithProfile | null | undefined
): string | undefined {
  try {
    let p: ProfileData | null | undefined;
    if (typeof user?.nostrProfile === "string") {
      const parsed: unknown = JSON.parse(user.nostrProfile);
      p =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as ProfileData)
          : null;
    } else {
      p = user?.nostrProfile;
    }
    return p &&
      typeof p === "object" &&
      "picture" in p &&
      typeof p.picture === "string"
      ? p.picture
      : undefined;
  } catch {
    return undefined;
  }
}

// Helper functions from NostrAuthButton
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

/** Get parsed nostrProfile (handles both string JSON and object) for display helpers. */
function getParsedNostrProfile(user: unknown): Record<string, unknown> | null {
  if (typeof user !== "object" || user === null || !("nostrProfile" in user))
    return null;
  const raw = (user as { nostrProfile?: unknown }).nostrProfile;
  if (raw == null) return null;
  if (typeof raw === "object" && !Array.isArray(raw))
    return raw as Record<string, unknown>;
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

function getUserDisplayName(user: unknown): string {
  const p = getParsedNostrProfile(user);
  if (p) {
    const name = p["name"];
    const displayName = p["display_name"];
    if (name != null && String(name).trim() !== "") return String(name);
    if (displayName != null && String(displayName).trim() !== "")
      return String(displayName);
  }

  if (
    typeof user === "object" &&
    user !== null &&
    "npub" in user &&
    user.npub
  ) {
    return formatNpubShort(String(user.npub));
  }

  return "";
}

function getUserAvatarFallback(user: unknown): string {
  const p = getParsedNostrProfile(user);
  if (p) {
    const name = p["name"];
    const displayName = p["display_name"];
    if (name != null && String(name).trim() !== "")
      return String(name)[0] ?? "U";
    if (displayName != null && String(displayName).trim() !== "")
      return String(displayName)[0] ?? "U";
  }
  return "U";
}

export default function UserMenu() {
  const user = useOptionalUser() as UserWithProfile | null | undefined;
  const subscription = useSubscription();
  const fetcher = useFetcher<{ children: ChildAccount[] }>();
  const logoutFetcher = useFetcher();
  const queryClient = useQueryClient();
  const hasReloadedRef = useRef(false);
  const wasSubmittingRef = useRef(false);
  const [open, setOpen] = React.useState(false);
  const [children, setChildren] = React.useState<ChildAccount[]>([]);

  // Safely handle potentially undefined subscription values
  const planId = (subscription?.currentSubscription?.planId ?? "")
    .toString()
    .toLowerCase();
  const planName = (subscription?.currentSubscription?.Plan?.name ?? "")
    .toString()
    .toLowerCase();
  const isChild = !!user?.["isChild"];
  const parentNpub = user?.["parentNpub"] as string | undefined;
  const commercialPlanType = mapLegacyPlanIdToCommercialPlanType(
    planId || planName
  );
  const hasAccountsAccess =
    !isChild && getCanonicalPlanPolicy(commercialPlanType).accountsIncluded > 1;

  React.useEffect(() => {
    if (
      open &&
      hasAccountsAccess &&
      fetcher.state === "idle" &&
      !fetcher.data
    ) {
      fetcher.load("/api/children");
    }
  }, [open, hasAccountsAccess, fetcher.state, fetcher]);

  React.useEffect(() => {
    if (fetcher.data?.children) setChildren(fetcher.data.children);
  }, [fetcher.data]);

  // Handle logout redirect - force full page reload to clear all state
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
      // Clear all client-side state
      clearActiveSignerConfig();
      queryClient.clear();
      // Force full page reload to ensure all Remix loader data is fresh
      window.location.href = "/";
    }
  }, [logoutFetcher.state, queryClient]);

  // Don't render if no user
  if (!user) return null;

  const onSwitch = async (childNpub: string) => {
    try {
      await fetch("/logout", { method: "POST", credentials: "same-origin" });
      window.location.assign(
        `/login?expectedPubkey=${encodeURIComponent(childNpub)}`
      );
    } catch (e) {
      const { handleErrorSafely } = require("~/lib/error-handler.client") as {
        handleErrorSafely: (
          error: unknown,
          context: { component: string; action: string }
        ) => void;
      };
      handleErrorSafely(e, {
        component: "UserMenu",
        action: "onSwitchAccount",
      });
    }
  };

  const onSwitchParent = async () => {
    if (!parentNpub) return;
    try {
      await fetch("/logout", { method: "POST", credentials: "same-origin" });
      window.location.assign(
        `/login?expectedPubkey=${encodeURIComponent(parentNpub)}`
      );
    } catch (e) {
      const { handleErrorSafely } = require("~/lib/error-handler.client") as {
        handleErrorSafely: (
          error: unknown,
          context: { component: string; action: string }
        ) => void;
      };
      handleErrorSafely(e, {
        component: "UserMenu",
        action: "onSwitchParent",
      });
    }
  };

  const currentAvatar = displayPicture(user) ?? getUserProfilePicture(user);
  const currentLabel = displayLabel(user);
  const displayName = getUserDisplayName(user);
  const avatarFallback = getUserAvatarFallback(user);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={`Account: ${displayName || currentLabel}`}
          className="h-9 w-9 shrink-0 overflow-hidden rounded-lg p-0 shadow-none sm:h-auto sm:w-auto sm:overflow-visible sm:rounded-lg sm:px-2 sm:py-1.5"
        >
          {/* Mobile: raw img fills the button — Button's overflow-hidden+rounded-lg clips it */}
          {currentAvatar ? (
            <img
              src={currentAvatar}
              alt=""
              aria-hidden="true"
              className="block h-full w-full object-cover sm:hidden"
            />
          ) : (
            <span
              className="text-xs leading-none font-medium sm:hidden"
              aria-hidden="true"
            >
              {avatarFallback}
            </span>
          )}
          {/* Desktop: standard circular avatar + display name */}
          <Avatar className="hidden h-6 w-6 sm:flex">
            {currentAvatar ? (
              <AvatarImage
                src={currentAvatar}
                alt={displayName || currentLabel}
              />
            ) : (
              <AvatarFallback className="text-xs">
                {avatarFallback}
              </AvatarFallback>
            )}
          </Avatar>
          <span className="hidden sm:ml-2 sm:inline">
            {displayName || currentLabel}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account</DialogTitle>
          <DialogDescription>
            Manage your account and switch between linked accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current User Info */}
          <div className="cluster-loose rounded-md border p-3">
            <Avatar className="h-10 w-10">
              {currentAvatar ? (
                <AvatarImage src={currentAvatar} alt={currentLabel} />
              ) : (
                <AvatarFallback>{avatarFallback}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{currentLabel}</div>
              <div className="text-text-secondary truncate text-xs">
                {formatNpubShort(user.npub)}
              </div>
              <div className="text-text-secondary text-xs">
                Currently signed in
              </div>
            </div>
          </div>

          {/* Account Switching Section */}
          {hasAccountsAccess ? (
            <div>
              <div className="mb-2 text-sm font-medium">Child accounts</div>
              <div className="divide-y rounded-md border">
                {children.length === 0 ? (
                  <div className="text-text-secondary p-3 text-sm">
                    No child accounts linked
                  </div>
                ) : (
                  children.map((c) => {
                    const label =
                      c.name ??
                      c.displayName ??
                      `${c.npub.slice(0, 8)}...${c.npub.slice(-8)}`;
                    return (
                      <div
                        key={c.npub}
                        className="flex items-center justify-between p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="h-8 w-8">
                            {c.picture ? (
                              <AvatarImage src={c.picture} alt={label} />
                            ) : (
                              <AvatarFallback>C</AvatarFallback>
                            )}
                          </Avatar>
                          <div className="min-w-0">
                            <div className="truncate font-medium">{label}</div>
                            <div className="text-text-secondary truncate text-xs">
                              {formatNpubShort(c.npub)}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => {
                            void onSwitch(c.npub);
                          }}
                          disabled={fetcher.state !== "idle"}
                        >
                          {fetcher.state !== "idle" ? "Switching..." : "Switch"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : null}

          {/* Switch to Parent (if child account) */}
          {isChild && parentNpub ? (
            <div className="rounded-md border p-3">
              <div className="mb-2 text-sm font-medium">Managed by account</div>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm">
                    {formatNpubShort(parentNpub)}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    void onSwitchParent();
                  }}
                  disabled={fetcher.state !== "idle"}
                >
                  {fetcher.state !== "idle"
                    ? "Switching..."
                    : "Switch to parent"}
                </Button>
              </div>
            </div>
          ) : null}

          {/* Account Management Link */}
          {hasAccountsAccess || (isChild && parentNpub) ? (
            <div className="flex justify-start">
              <Link
                to="/dashboard/settings?tab=accounts"
                className="text-sm underline underline-offset-2"
                onClick={() => setOpen(false)}
              >
                Manage accounts
              </Link>
            </div>
          ) : null}

          {/* Logout Button */}
          <Separator className="my-4" />
          <div className="pt-4">
            <logoutFetcher.Form action="/logout" method="post">
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                size="sm"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </logoutFetcher.Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
