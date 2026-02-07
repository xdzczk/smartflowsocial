/**
 * New post page header component.
 * No hashtag badge (excluded from composer spec).
 * Status pill and Relays link for composer confidence.
 */

import { Badge } from "~/components/ui/badge";

export type ComposerStatus =
  | "Draft"
  | "Ready"
  | "Scheduled"
  | "Signing…"
  | "Publishing…"
  | "Failed";

interface NewPostHeaderProps {
  /** Current composer status for the status pill */
  status?: ComposerStatus;
  /** Number of relays selected (for "Relays: X selected" link) */
  relayCount?: number;
  /** Called when user clicks the relays link (open relay selector modal) */
  onRelayClick?: () => void;
}

export function NewPostHeader({
  status = "Draft",
  relayCount = 0,
  onRelayClick,
}: NewPostHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-foreground text-2xl font-bold dark:text-white">
        Create post
      </h1>
      <div className="flex flex-wrap items-center gap-2">
        {onRelayClick ? (
          <button
            type="button"
            onClick={onRelayClick}
            className="text-muted-foreground hover:text-foreground focus:ring-primary rounded text-sm underline focus:ring-2 focus:outline-none"
          >
            Relays: {relayCount} selected
          </button>
        ) : (
          <span className="text-muted-foreground text-sm">
            Relays: {relayCount} selected
          </span>
        )}
        <Badge
          variant={status === "Failed" ? "destructive" : "secondary"}
          className="shrink-0"
        >
          {status}
        </Badge>
      </div>
    </div>
  );
}
