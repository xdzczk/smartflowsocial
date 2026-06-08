import { Form } from "@remix-run/react";
import type { ReactNode } from "react";

import { BannerDismissButton } from "~/components/ui/BannerDismissButton";
import {
  sessionDismissStorageKey,
  useSessionDismissedBanner,
} from "~/lib/hooks/useSessionDismissedBanner";

function ProfileBits({ nostrProfile }: { nostrProfile: unknown }): ReactNode {
  let name: string | undefined;
  let display_name: string | undefined;
  try {
    const p =
      typeof nostrProfile === "string"
        ? (JSON.parse(nostrProfile) as { name?: string; display_name?: string })
        : (nostrProfile as
            | { name?: string; display_name?: string }
            | undefined);
    name = p?.name;
    display_name = p?.display_name;
  } catch {
    /* ignore parse errors */
  }
  return <>{name ?? display_name ?? "Unknown User"}</>;
}

export function PendingParentRequestBanner({
  parentNpub,
  nostrProfile,
  isSubmitting,
  submitDecision,
}: {
  parentNpub: string;
  nostrProfile: unknown;
  isSubmitting: boolean;
  submitDecision: string | null;
}) {
  const { isDismissed, dismiss } = useSessionDismissedBanner(
    sessionDismissStorageKey("parent-request", parentNpub)
  );

  if (isDismissed) return null;

  return (
    <div className="border-warning/40 bg-warning/12 text-warning-text dark:border-warning/40 dark:bg-warning/15 dark:text-warning mb-4 flex items-start justify-between gap-3 rounded-lg border p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">
          <ProfileBits nostrProfile={nostrProfile} /> wants to manage your
          account
        </p>
        <p className="text-sm opacity-90">
          Approve to link your account as a child, or reject this request.
        </p>
      </div>
      <div className="cluster-tight.5 self-start md:ml-4 md:shrink-0">
        <div className="flex gap-2">
          <Form method="post">
            <input type="hidden" name="_action" value="respond_child_request" />
            <input type="hidden" name="parentNpub" value={parentNpub} />
            <input type="hidden" name="decision" value="reject" />
            <button
              className="bg-surface-hover text-text hover:bg-surface-active inline-flex items-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && submitDecision === "reject"
                ? "Rejecting..."
                : "Reject"}
            </button>
          </Form>
          <Form method="post">
            <input type="hidden" name="_action" value="respond_child_request" />
            <input type="hidden" name="parentNpub" value={parentNpub} />
            <input type="hidden" name="decision" value="accept" />
            <button
              className="focus-ring bg-action-primary text-action-primary-foreground hover:bg-action-primary/90 inline-flex items-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-70"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting && submitDecision === "accept"
                ? "Approving..."
                : "Approve"}
            </button>
          </Form>
        </div>
        <BannerDismissButton
          ariaLabel="Dismiss parent account request banner"
          onClick={dismiss}
        />
      </div>
    </div>
  );
}
