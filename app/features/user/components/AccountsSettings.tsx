import { useFetcher, useRevalidator } from "@remix-run/react";
import * as React from "react";

import { Avatar, AvatarImage } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import type { ProfileData } from "~/features/nostr/types";
interface AccountInfo {
  npub: string;
  nostrProfile?: ProfileData | null;
}

interface SearchResult {
  id: string;
  npub: string;
  profileName?: string;
  profileDisplayName?: string;
  profilePicture?: string;
  isChild?: boolean;
  parentNpub?: string | null;
  pendingParentRequests?: string[];
}

function extractProfileBits(nostrProfile: ProfileData | null | undefined) {
  if (!nostrProfile)
    return {
      name: undefined,
      display_name: undefined,
      picture: undefined,
    } as const;
  try {
    if (typeof nostrProfile === "string") {
      const p = JSON.parse(nostrProfile) as { name?: string; display_name?: string; picture?: string };
      return {
        name: p?.name,
        display_name: p?.display_name,
        picture: p?.picture,
      } as const;
    }
    if (typeof nostrProfile === "object") {
      const p = nostrProfile;
      return {
        name: p?.name,
        display_name: p?.display_name,
        picture: p?.picture,
      } as const;
    }
  } catch {
    // Ignore parsing errors, return defaults
  }
  return {
    name: undefined,
    display_name: undefined,
    picture: undefined,
  } as const;
}

export function AccountsSettings({
  parentNpub,
  confirmedChildren,
  pendingChildren,
  isChild = false,
  parentUser,
}: {
  parentNpub?: string;
  confirmedChildren?: AccountInfo[];
  pendingChildren?: AccountInfo[];
  isChild?: boolean;
  parentUser?: AccountInfo | null;
}) {
  const fetcher = useFetcher<{ results?: SearchResult[]; error?: string }>();
  const [q, setQ] = React.useState("");
  const revalidator = useRevalidator();

  // Prevent duplicate submissions due to re-renders by remembering last query
  const lastSubmittedRef = React.useRef("");

  React.useEffect(() => {
    const value = q.trim();
    if (!value) {
      lastSubmittedRef.current = "";
      return;
    }
    if (lastSubmittedRef.current === value) return;

    const i = setTimeout(() => {
      lastSubmittedRef.current = value;
      fetcher.submit(
        { _action: "search_accounts", q: value },
        { method: "post" },
      );
    }, 300);

    return () => clearTimeout(i);
  }, [q, fetcher]);

  const onRequestChild = (childNpub: string) => {
    const np = (childNpub ?? "").trim();
    fetcher.submit(
      { _action: "request_child", childNpub: np },
      { method: "post", action: "/dashboard/settings" },
    );
  };

  // Submission state feedback
  const submittingAction = (fetcher.formData?.get("_action") as string) ?? undefined;
  const submittingChildNpub = (fetcher.formData?.get("childNpub") as string) ?? undefined;
  const isUnlinking = submittingAction === "unlink_parent" && fetcher.state !== "idle";

  React.useEffect(() => {
    if (
      (submittingAction === "unlink_parent" || submittingAction === "unlink_child" || submittingAction === "cancel_child_request") &&
      fetcher.state === "idle" &&
      (fetcher.data as { success?: boolean } | undefined)?.success
    ) {
      revalidator.revalidate();
    }
  }, [fetcher.state, fetcher.data, submittingAction, revalidator]);

  const _renderAccountRow = (npub: string, nostrProfile?: ProfileData | null) => {
    const bits = extractProfileBits(nostrProfile);
    return (
      <div
        key={npub}
        className="flex items-center justify-between border-b py-2 last:border-0"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="h-8 w-8">
            {bits.picture ? (
              <AvatarImage
                src={bits.picture}
                alt={(bits.name ?? bits.display_name) ?? npub}
              />
            ) : null}
          </Avatar>
          <div className="min-w-0">
            <div className="truncate font-medium">
              {(bits.name ?? bits.display_name) ?? npub}
            </div>
            <div className="truncate text-xs text-muted-foreground">{npub}</div>
          </div>
        </div>
      </div>
    );
  };

  const results = fetcher.data?.results ?? [];

  if (isChild) {
    const bits = extractProfileBits(parentUser?.nostrProfile);
    const parentName =
      (bits.name ?? bits.display_name) ?? (parentUser?.npub ?? "Parent");
    return (
      <Card className="p-4">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">Accounts</h2>
          <p className="text-sm text-muted-foreground">
            This account is managed by a parent account.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between rounded-md border bg-muted/30 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="h-10 w-10">
              {bits.picture ? (
                <AvatarImage src={bits.picture} alt={parentName} />
              ) : null}
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">
                Managed by {parentName}
              </div>
              {parentUser?.npub ? (
                <div className="truncate text-xs text-muted-foreground">
                  {parentUser.npub}
                </div>
              ) : null}
            </div>
          </div>
          <Button
            size="sm"
            variant="destructive"
            disabled={isUnlinking}
            onClick={() => fetcher.submit({ _action: "unlink_parent" }, { method: "post", action: "/dashboard/settings" })}
          >
            {isUnlinking ? "Unlinking..." : "Unlink from Parent"}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          As a child account, you cannot search for or link child accounts.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Accounts</h2>
        <p className="text-sm text-muted-foreground">Search Nostr users by profile name and request to add them as child accounts.</p>
      </div>

      <div className="mb-6">
        <label htmlFor="accounts-search" className="mb-2 block text-sm font-medium">Search users</label>
        <Input
          id="accounts-search"
          placeholder="Search by name or npub..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {q.trim() ? (
        <div className="mb-8">
          <h3 className="mb-2 text-sm font-medium">Search results</h3>
          <div className="divide-y rounded-md border">
            {results.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No results</div>
            ) : (
              results.map((r) => {
                const isSubmittingThis =
                  submittingAction === "request_child" && submittingChildNpub === r.npub && fetcher.state !== "idle";
                const disabled =
                  isSubmittingThis ||
                  r.npub === parentNpub ||
                  (r.pendingParentRequests ?? []).includes(parentNpub ?? "") ||
                  r.parentNpub === parentNpub ||
                  r.isChild === true;
                const label = isSubmittingThis
                  ? "Requesting..."
                  : r.npub === parentNpub
                    ? "This is you"
                    : (r.pendingParentRequests ?? []).includes(parentNpub ?? "")
                    ? "Requested"
                    : r.parentNpub
                    ? "Has a parent"
                    : r.isChild
                    ? "Is a child"
                    : "Request";

                return (
                  <div key={r.id} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        {r.profilePicture ? (
                          <AvatarImage src={r.profilePicture} alt={(r.profileName ?? r.profileDisplayName) ?? r.npub} />
                        ) : null}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{(r.profileName ?? r.profileDisplayName) ?? r.npub}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.npub}</div>
                      </div>
                    </div>
                    <Button size="sm" variant={disabled ? "secondary" : "default"} disabled={disabled} onClick={() => onRequestChild(r.npub)}>
                      {label}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          {fetcher.data?.error ? (
            <p className="mt-2 text-sm text-red-600">{fetcher.data.error}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h3 className="mb-2 text-sm font-medium">Confirmed children</h3>
          <div className="divide-y rounded-md border">
            {confirmedChildren?.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No confirmed children</div>
            ) : (
              (confirmedChildren ?? []).map((u) => {
                const bits = extractProfileBits(u.nostrProfile);
                const removingThis =
                  submittingAction === "unlink_child" &&
                  (fetcher.formData?.get("childNpub") as string) === u.npub &&
                  fetcher.state !== "idle";
                return (
                  <div key={u.npub} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        {bits.picture ? (
                          <AvatarImage src={bits.picture} alt={(bits.name ?? bits.display_name) ?? u.npub} />
                        ) : null}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{(bits.name ?? bits.display_name) ?? u.npub}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.npub}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={removingThis}
                      onClick={() =>
                        fetcher.submit(
                          { _action: "unlink_child", childNpub: u.npub },
                          { method: "post", action: "/dashboard/settings" },
                        )
                      }
                    >
                      {removingThis ? "Removing..." : "Remove"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div>
          <h3 className="mb-2 text-sm font-medium">Pending requests</h3>
          <div className="divide-y rounded-md border">
            {pendingChildren?.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">No pending requests</div>
            ) : (
              (pendingChildren ?? []).map((u) => {
                const bits = extractProfileBits(u.nostrProfile);
                const cancelingThis =
                  submittingAction === "cancel_child_request" &&
                  (fetcher.formData?.get("childNpub") as string) === u.npub &&
                  fetcher.state !== "idle";
                return (
                  <div key={u.npub} className="flex items-center justify-between p-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-8 w-8">
                        {bits.picture ? (
                          <AvatarImage src={bits.picture} alt={(bits.name ?? bits.display_name) ?? u.npub} />
                        ) : null}
                      </Avatar>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{(bits.name ?? bits.display_name) ?? u.npub}</div>
                        <div className="text-xs text-muted-foreground truncate">{u.npub}</div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={cancelingThis}
                      onClick={() =>
                        fetcher.submit(
                          { _action: "cancel_child_request", childNpub: u.npub },
                          { method: "post", action: "/dashboard/settings" },
                        )
                      }
                    >
                      {cancelingThis ? "Canceling..." : "Cancel"}
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
