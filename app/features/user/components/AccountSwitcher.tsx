import { useFetcher } from "@remix-run/react";
import * as React from "react";

import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useSubscription } from "~/features/payments/types";
import { useOptionalUser } from "~/lib/remix-utils";

interface ChildAccount {
  npub: string;
  name?: string;
  displayName?: string;
  picture?: string;
}

export default function AccountSwitcher() {
  const user = useOptionalUser();
  const subscription = useSubscription();
  const fetcher = useFetcher<{ children: ChildAccount[] }>();
  const [children, setChildren] = React.useState<ChildAccount[]>([]);

  const planId = (
    subscription?.currentSubscription?.planId ?? ""
  ).toLowerCase();
  const planName = (
    subscription?.currentSubscription?.Plan?.name ?? ""
  ).toLowerCase();
  const hasAccountsAccess =
    planId === "premium" || planName === "premium" || planName === "founder";
  const isChild = !!user?.isChild;

  React.useEffect(() => {
    if (
      !isChild &&
      hasAccountsAccess &&
      fetcher.state === "idle" &&
      !fetcher.data
    ) {
      fetcher.load("/api/children");
    }
  }, [isChild, hasAccountsAccess, fetcher.state, fetcher]);

  React.useEffect(() => {
    if (fetcher.data?.children) {
      setChildren(fetcher.data.children);
    }
  }, [fetcher.data]);

  // Hide if not allowed or no children
  if (isChild || !hasAccountsAccess || children.length === 0) return null;

  const handleSwitch = async (childNpub: string) => {
    try {
      // Switching accounts is an identity change: logout + re-authenticate.
      await fetch("/logout", { method: "POST", credentials: "same-origin" });
      window.location.assign(
        `/login?redirectTo=${encodeURIComponent("/dashboard")}&expectedPubkey=${encodeURIComponent(childNpub)}`
      );
    } catch (e) {
      const { handleErrorSafely } =
        require("~/lib/error-handler.client") as unknown as {
          handleErrorSafely: (
            error: unknown,
            context: { component: string; action: string }
          ) => void;
        };
      handleErrorSafely(e, {
        component: "AccountSwitcher",
        action: "handleAccountSwitch",
      });
    }
  };

  return (
    <div className="flex items-center">
      <Select
        onValueChange={(value) => {
          void handleSwitch(value);
        }}
      >
        <SelectTrigger className="dark:bg-card h-9 w-[220px] bg-white text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {children.map((c) => {
            const label =
              c.name ??
              c.displayName ??
              `${c.npub.slice(0, 8)}...${c.npub.slice(-8)}`;
            return (
              <SelectItem key={c.npub} value={c.npub}>
                <div className="flex items-center gap-2">
                  <Avatar className="h-5 w-5">
                    {c.picture ? (
                      <AvatarImage src={c.picture} alt={label} />
                    ) : (
                      <AvatarFallback>C</AvatarFallback>
                    )}
                  </Avatar>
                  <span>{label}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
