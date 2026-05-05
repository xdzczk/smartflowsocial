import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { ScheduledPostActionBar } from "~/features/posts/scheduled/components/ScheduledPostActionBar";

export function PostDetailFooterBar({
  type,
  showOpenOnNostr,
  openOnNostrUrl,
  showViewThread,
  viewThreadUrl,
  viewThreadLabel = "View thread",
  secondaryNostrLink,
  onEdit,
  onReschedule,
  deleteForm,
  scheduledNeedsQueueResign,
  scheduledEditDisabled,
  scheduledEditDisabledReason,
  scheduledOpenFullEditorHref,
}: {
  type: "draft" | "published" | "scheduled";
  showOpenOnNostr: boolean;
  openOnNostrUrl: string | null;
  showViewThread: boolean;
  viewThreadUrl: string;
  viewThreadLabel?: string;
  secondaryNostrLink?: { label: string; href: string } | null;
  onEdit?: () => void;
  onReschedule?: () => void;
  deleteForm: React.ReactNode;
  scheduledNeedsQueueResign?: boolean;
  scheduledEditDisabled?: boolean;
  scheduledEditDisabledReason?: string;
  scheduledOpenFullEditorHref?: string | null;
}) {
  if (type === "scheduled") {
    return (
      <ScheduledPostActionBar
        onEdit={onEdit}
        onReschedule={onReschedule}
        needsQueueResign={Boolean(scheduledNeedsQueueResign)}
        editDisabled={Boolean(scheduledEditDisabled)}
        editDisabledReason={scheduledEditDisabledReason}
        openFullEditorHref={scheduledOpenFullEditorHref ?? undefined}
        deleteForm={deleteForm}
      />
    );
  }

  return (
    <div className="border-border/70 bg-surface/95 shrink-0 border-t px-6 py-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-text-secondary min-h-[36px] text-xs">
          {deleteForm}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {type === "published" && showOpenOnNostr && openOnNostrUrl ? (
            <Button variant="outline" size="sm" asChild>
              <Link
                to={openOnNostrUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open on Nostr (opens in new tab)"
              >
                Open on Nostr
              </Link>
            </Button>
          ) : null}
          {type === "published" && secondaryNostrLink ? (
            <Button variant="ghost" size="sm" asChild>
              <Link
                to={secondaryNostrLink.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${secondaryNostrLink.label} (opens in new tab)`}
              >
                {secondaryNostrLink.label}
              </Link>
            </Button>
          ) : null}
          {type === "published" && showViewThread ? (
            <Button variant="default" size="sm" asChild>
              <Link
                to={viewThreadUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${viewThreadLabel} (opens in new tab)`}
              >
                {viewThreadLabel}
              </Link>
            </Button>
          ) : null}
          {type === "draft" && onEdit ? (
            <Button variant="default" size="sm" onClick={onEdit}>
              Edit draft
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
