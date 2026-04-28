import { Link, useFetcher } from "@remix-run/react";
import { RefreshCw } from "lucide-react";
import * as React from "react";

import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import type { ProfileData } from "~/features/nostr/types";
import { mapLegacyPlanIdToCommercialPlanType } from "~/features/payments/plan-mapping";
import { getCanonicalPlanPolicy } from "~/features/payments/plan-policy";
import { useSubscription } from "~/features/payments/types";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
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

export default function AccountSwitchMenu() {
  const user = useOptionalUser() as UserWithProfile | null | undefined;
  const subscription = useSubscription();
  const fetcher = useFetcher<{ children: ChildAccount[] }>();
  const parentFetcher = useFetcher<{ parent: ChildAccount | null }>();
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

  React.useEffect(() => {
    if (fetcher.data?.children) setChildren(fetcher.data.children);
  }, [fetcher.data]);

  // Hide trigger if not parent with access and not a child with parent link
  if (!hasAccountsAccess && !(isChild && parentNpub)) return null;

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
        component: "AccountSwitchMenu",
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
        component: "AccountSwitchMenu",
        action: "onSwitchParent",
      });
    }
  };

  const currentAvatar = displayPicture(user);
  const currentLabel = displayLabel(user);

  const parentFromApi = parentFetcher.data?.parent;
  const parentLabel =
    parentFromApi?.name ??
    parentFromApi?.displayName ??
    (parentNpub ? formatNpubShort(parentNpub) : "");
  const parentPicture = parentFromApi?.picture;
  const accountActionPending =
    fetcher.state !== "idle" || parentFetcher.state !== "idle";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className={INLINE_ICON_SIZE_CLASS} />
          <span className="hidden sm:inline">Accounts</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch account</DialogTitle>
          <DialogDescription>
            Choose an account to switch to or manage your linked accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="cluster-loose rounded-md border p-3">
            <Avatar className="h-8 w-8">
              {currentAvatar ? (
                <AvatarImage src={currentAvatar} alt={currentLabel} />
              ) : (
                <AvatarFallback>{currentLabel[0] ?? "U"}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{currentLabel}</div>
              <div className="text-text-secondary truncate text-xs">
                {formatNpubShort(user?.npub)}
              </div>
              <div className="text-text-secondary text-xs">
                Currently signed in
              </div>
            </div>
          </div>

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
                          <Avatar className="h-7 w-7">
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

          <div className="flex justify-between">
            <Link
              to="/dashboard/settings?tab=accounts"
              className="text-sm underline underline-offset-2"
            >
              Manage accounts
            </Link>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
