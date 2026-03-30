import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

export function PostDetailFooterBar({
  type,
  showOpenOnNostr,
  openOnNostrUrl,
  showViewThread,
  viewThreadUrl,
  onEdit,
  onReschedule,
  deleteForm,
}: {
  type: "draft" | "published" | "scheduled";
  showOpenOnNostr: boolean;
  openOnNostrUrl: string | null;
  showViewThread: boolean;
  viewThreadUrl: string;
  onEdit?: () => void;
  onReschedule?: () => void;
  deleteForm: React.ReactNode;
}) {
  return (
    <div className="border-border/60 bg-card/95 shrink-0 border-t px-5 py-3.5 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {type === "published" && showOpenOnNostr && openOnNostrUrl ? (
          <Button variant="default" size="sm" asChild>
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
        {type === "published" && showViewThread ? (
          <Button variant="outline" size="sm" asChild>
            <Link
              to={viewThreadUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View thread (opens in new tab)"
            >
              View thread
            </Link>
          </Button>
        ) : null}
        {type === "scheduled" && onEdit ? (
          <Button variant="default" size="sm" type="button" onClick={onEdit}>
            Edit
          </Button>
        ) : null}
        {type === "scheduled" && onReschedule ? (
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={onReschedule}
          >
            Reschedule
          </Button>
        ) : null}
        <div className="border-border/60 ml-1 flex items-center border-l border-dashed pl-3">
          {deleteForm}
        </div>
      </div>
    </div>
  );
}
