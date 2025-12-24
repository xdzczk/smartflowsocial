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
import { useSubscription } from "~/features/payments/types";
import { hexToNpub } from "~/lib/nostr";
import { useOptionalUser } from "~/lib/remix-utils";

interface ChildAccount {
  npub: string;
  name?: string;
  displayName?: string;
  picture?: string;
}

function displayLabel(user: any): string {
  try {
    const p =
      typeof user?.nostrProfile === "string"
        ? JSON.parse(user.nostrProfile)
        : user?.nostrProfile;
    return p?.name || p?.display_name || formatNpubShort(user?.npub);
  } catch {
    return formatNpubShort(user?.npub);
  }
}

function displayPicture(user: any): string | undefined {
  try {
    const p =
      typeof user?.nostrProfile === "string"
        ? JSON.parse(user.nostrProfile)
        : user?.nostrProfile;
    return p?.picture || undefined;
  } catch {
    return undefined;
  }
}

function formatNpubShort(hexOrNpub?: string): string {
  if (!hexOrNpub) return "";
  const np = hexOrNpub.startsWith("npub")
    ? hexOrNpub
    : hexToNpub(hexOrNpub) || hexOrNpub;
  if (!np) return "";
  if (np.length <= 20) return np; // already short
  return `${np.slice(0, 8)}...${np.slice(-8)}`;
}

export default function AccountSwitchMenu() {
  const user = useOptionalUser() as any;
  const subscription = useSubscription();
  const fetcher = useFetcher<{ children: ChildAccount[] }>();
  const [open, setOpen] = React.useState(false);
  const [children, setChildren] = React.useState<ChildAccount[]>([]);

  // Safely handle potentially undefined subscription values
  const planId = (
    subscription?.currentSubscription?.planId ?? ""
  )?.toString?.().toLowerCase?.() ?? "";
  const planName = (
    subscription?.currentSubscription?.Plan?.name ?? ""
  )?.toString?.().toLowerCase?.() ?? "";
  const isChild = !!user?.isChild;
  const parentNpub = user?.parentNpub as string | undefined;
  const hasAccountsAccess =
    !isChild &&
    (planId === "premium" || planName === "premium" || planName === "founder");

  React.useEffect(() => {
    if (
      open &&
      hasAccountsAccess &&
      fetcher.state === "idle" &&
      !fetcher.data
    ) {
      fetcher.load("/api/children");
    }
  }, [open, hasAccountsAccess, fetcher.state]);

  React.useEffect(() => {
    if (fetcher.data?.children) setChildren(fetcher.data.children);
  }, [fetcher.data]);

  // Hide trigger if not parent with access and not a child with parent link
  if (!hasAccountsAccess && !(isChild && parentNpub)) return null;

  const onSwitch = async (childNpub: string) => {
    try {
      const { init } = await import("nostr-login");
      await init({
        methods: ["connect", "extension"],
        noBanner: true,
        onAuth: async () => {
          if (window.nostr) {
            const contentSign = `Switch account ${Math.random().toString(36).slice(2, 12)}`;
            const event = {
              kind: 27235,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content: contentSign,
            } as any;
            const signedEvent = await window.nostr.signEvent(event);
            if (signedEvent.pubkey !== childNpub) {
              // Silent no-op on mismatch
              return;
            }
            const formData = new FormData();
            formData.append("pubkey", signedEvent.pubkey);
            formData.append("signature", signedEvent.sig);
            formData.append("event", JSON.stringify(signedEvent));
            formData.append("contentSign", contentSign);
            formData.append("redirectTo", "/dashboard");
            fetcher.submit(formData, { method: "post", action: "/nostr-auth" });
          }
        },
      });
      document.dispatchEvent(new CustomEvent("nlLaunch", { detail: "switch" }));
    } catch (e) {
      const { handleErrorSafely } = require("~/lib/error-handler.client");
      handleErrorSafely(e, {
        component: "AccountSwitchMenu",
        action: "onSwitchAccount",
      });
    }
  };

  const onSwitchParent = async () => {
    if (!parentNpub) return;
    try {
      const { init } = await import("nostr-login");
      await init({
        methods: ["connect", "extension"],
        noBanner: true,
        onAuth: async () => {
          if (window.nostr) {
            const contentSign = `Switch parent ${Math.random().toString(36).slice(2, 12)}`;
            const event = {
              kind: 27235,
              created_at: Math.floor(Date.now() / 1000),
              tags: [],
              content: contentSign,
            } as any;
            const signedEvent = await window.nostr.signEvent(event);
            if (signedEvent.pubkey !== parentNpub) {
              // Silent no-op on mismatch
              return;
            }
            const formData = new FormData();
            formData.append("pubkey", signedEvent.pubkey);
            formData.append("signature", signedEvent.sig);
            formData.append("event", JSON.stringify(signedEvent));
            formData.append("contentSign", contentSign);
            formData.append("redirectTo", "/dashboard");
            fetcher.submit(formData, { method: "post", action: "/nostr-auth" });
          }
        },
      });
      document.dispatchEvent(new CustomEvent("nlLaunch", { detail: "switch" }));
    } catch (e) {
      const { handleErrorSafely } = require("~/lib/error-handler.client");
      handleErrorSafely(e, {
        component: "AccountSwitchMenu",
        action: "onSwitchParent",
      });
    }
  };

  const currentAvatar = displayPicture(user);
  const currentLabel = displayLabel(user);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-4 w-4" />
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
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Avatar className="h-8 w-8">
              {currentAvatar ? (
                <AvatarImage src={currentAvatar} alt={currentLabel} />
              ) : (
                <AvatarFallback>{currentLabel?.[0] || "U"}</AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{currentLabel}</div>
              <div className="truncate text-xs text-muted-foreground">
                {formatNpubShort(user?.npub)}
              </div>
              <div className="text-xs text-muted-foreground">
                Currently signed in
              </div>
            </div>
          </div>

          {hasAccountsAccess ? (
            <div>
              <div className="mb-2 text-sm font-medium">Child accounts</div>
              <div className="divide-y rounded-md border">
                {children.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground">
                    No child accounts linked
                  </div>
                ) : (
                  children.map((c) => {
                    const label =
                      c.name ||
                      c.displayName ||
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
                            <div className="truncate text-xs text-muted-foreground">
                              {formatNpubShort(c.npub)}
                            </div>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => onSwitch(c.npub)}
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
                  onClick={onSwitchParent}
                  disabled={fetcher.state !== "idle"}
                >
                  {fetcher.state !== "idle"
                    ? "Switching..."
                    : "Switch to parent"}
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
