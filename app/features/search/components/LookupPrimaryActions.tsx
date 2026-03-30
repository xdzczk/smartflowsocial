import { Link } from "@remix-run/react";
import { ExternalLink, Quote, Repeat } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import type { NostrClientConfig } from "~/lib/nostr-client-urls";
import { eventUrl } from "~/lib/nostr-client-urls";

export interface LookupPrimaryActionsProps {
  eventId: string;
  nostrClientConfig: NostrClientConfig;
  viewEventLabel: string;
  onScheduleQuote: () => void;
  onScheduleRepost: () => void;
  /** Extra wrapper classes (e.g. card padding on mobile). */
  className?: string;
}

export function LookupPrimaryActions({
  eventId,
  nostrClientConfig,
  viewEventLabel,
  onScheduleQuote,
  onScheduleRepost,
  className = "",
}: LookupPrimaryActionsProps) {
  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <Button
        type="button"
        variant="default"
        className="h-10 w-full justify-center gap-2 rounded-lg text-sm font-semibold"
        onClick={onScheduleQuote}
      >
        <Quote
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Schedule Quote Post
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="h-10 w-full justify-center gap-2 rounded-lg text-sm font-semibold"
        onClick={onScheduleRepost}
      >
        <Repeat
          className={INLINE_ICON_SIZE_CLASS}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        Schedule Repost (Kind 6)
      </Button>
      <Button
        type="button"
        variant="ghost"
        className="text-muted-foreground hover:text-foreground h-10 w-full justify-center gap-2 rounded-lg text-sm font-medium"
        asChild
      >
        <Link
          to={eventUrl(eventId, nostrClientConfig)}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ExternalLink
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          View on {viewEventLabel}
        </Link>
      </Button>
    </div>
  );
}
