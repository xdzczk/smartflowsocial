import { Link, useFetcher } from "@remix-run/react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Button, type ButtonProps } from "~/components/ui/button";
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
import { cn } from "~/lib/utils";

/** Radix Dialog trigger needs client-only ids; store flips after first microtask so SSR + first paint stay in sync. */
const dialogShellListeners = new Set<() => void>();
let dialogShellStoreReady = false;

function subscribeDialogShellReady(onStoreChange: () => void) {
  dialogShellListeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    queueMicrotask(() => {
      if (dialogShellStoreReady) return;
      dialogShellStoreReady = true;
      for (const l of dialogShellListeners) l();
    });
  }
  return () => {
    dialogShellListeners.delete(onStoreChange);
  };
}

function getDialogShellSnapshot() {
  return dialogShellStoreReady;
}

function getDialogShellServerSnapshot() {
  return false;
}

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

const UserMenuAccountTrigger = forwardRef<
  HTMLButtonElement,
  {
    displayName: string;
    currentLabel: string;
    currentAvatar: string | undefined;
    avatarFallback: string;
  } & Omit<ButtonProps, "variant" | "size" | "type">
>(function UserMenuAccountTrigger(
  {
    displayName,
    currentLabel,
    currentAvatar,
    avatarFallback,
    className,
    ...buttonProps
  },
  ref
) {
  const labelText = displayName || currentLabel;
  /**
   * Desktop: fixed-width column, slight vertical bleed clipped by overflow.
   * Mobile: `tap-target` can enlarge the control to 44×44 on coarse pointers while
   * we keep h-9 w-9 as the visual baseline — fill with absolute inset-0 so the PFP
   * never letterboxes inside the button.
   */
  const triggerAvatarClass = cn(
    "rounded-none",
    "absolute inset-0 h-full w-full",
    "sm:static sm:inset-auto sm:h-[calc(2.25rem+2px)] sm:w-9 sm:shrink-0 sm:-my-px"
  );
  return (
    <Button
      ref={ref}
      variant="outline"
      size="default"
      type="button"
      aria-label={`Account: ${labelText}`}
      className={cn(
        "relative h-9 min-h-9 w-9 shrink-0 justify-center gap-0 overflow-hidden rounded-lg p-0 pl-0 shadow-none",
        "flex flex-row items-center",
        "sm:w-auto sm:min-w-0 sm:justify-start sm:gap-2.5 sm:pr-3",
        className
      )}
      {...buttonProps}
    >
      <Avatar className={triggerAvatarClass}>
        {currentAvatar ? (
          <AvatarImage
            src={currentAvatar}
            alt=""
            className="object-cover"
            aria-hidden
          />
        ) : (
          <AvatarFallback className="rounded-none text-xs font-medium">
            {avatarFallback}
          </AvatarFallback>
        )}
      </Avatar>
      <span className="text-text hidden max-w-[7.5rem] min-w-0 shrink truncate text-left text-sm font-medium sm:block sm:max-w-[10.5rem] lg:max-w-[12.5rem]">
        {labelText}
      </span>
    </Button>
  );
});
UserMenuAccountTrigger.displayName = "UserMenuAccountTrigger";

export default function UserMenu() {
  const user = useOptionalUser() as UserWithProfile | null | undefined;
  const subscription = useSubscription();
  const fetcher = useFetcher<{ children: ChildAccount[] }>();
  const parentFetcher = useFetcher<{ parent: ChildAccount | null }>();
  const logoutFetcher = useFetcher();
  const queryClient = useQueryClient();
  const hasReloadedRef = useRef(false);
  const wasSubmittingRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<ChildAccount[]>([]);
  const dialogShellReady = useSyncExternalStore(
    subscribeDialogShellReady,
    getDialogShellSnapshot,
    getDialogShellServerSnapshot
  );

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

  useEffect(() => {
    if (
      open &&
      hasAccountsAccess &&
      fetcher.state === "idle" &&
      !fetcher.data
    ) {
      fetcher.load("/api/children");
    }
  }, [open, hasAccountsAccess, fetcher.state, fetcher]);

  useEffect(() => {
    if (
      open &&
      isChild &&
      parentNpub &&
      parentFetcher.state === "idle" &&
      !parentFetcher.data
    ) {
      parentFetcher.load("/api/parent");
    }
  }, [open, isChild, parentNpub, parentFetcher.state, parentFetcher]);

  useEffect(() => {
    if (fetcher.data?.children) {
      queueMicrotask(() => setChildren(fetcher.data!.children));
    }
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

  const parentFromApi = parentFetcher.data?.parent;
  const parentLabel =
    parentFromApi?.name ??
    parentFromApi?.displayName ??
    (parentNpub ? formatNpubShort(parentNpub) : "");
  const parentPicture = parentFromApi?.picture;
  const accountActionPending =
    fetcher.state !== "idle" || parentFetcher.state !== "idle";

  const triggerProps = {
    displayName,
    currentLabel,
    currentAvatar,
    avatarFallback,
  };

  // Mount Dialog after hydration so Radix-generated ids / aria-controls match
  // between SSR and the first client paint (see dialogShellReady).
  if (!dialogShellReady) {
    return (
      <UserMenuAccountTrigger
        {...triggerProps}
        aria-haspopup="dialog"
        aria-expanded={false}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <UserMenuAccountTrigger {...triggerProps} />
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
                          disabled={accountActionPending}
                        >
                          {accountActionPending ? "Switching..." : "Switch"}
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
            <div>
              <div className="mb-2 text-sm font-medium">Managed by account</div>
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {parentPicture ? (
                      <AvatarImage
                        src={parentPicture}
                        alt={parentLabel || "Parent"}
                      />
                    ) : (
                      <AvatarFallback>
                        {(parentLabel || "P").slice(0, 1).toUpperCase()}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {parentLabel || formatNpubShort(parentNpub)}
                    </div>
                    <div className="text-text-secondary truncate text-xs">
                      {formatNpubShort(parentNpub)}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    void onSwitchParent();
                  }}
                  disabled={accountActionPending}
                >
                  {accountActionPending ? "Switching..." : "Switch to parent"}
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
