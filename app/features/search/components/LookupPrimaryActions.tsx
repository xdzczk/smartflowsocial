import { Quote, Repeat } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

export interface LookupPrimaryActionsProps {
  onScheduleQuote: () => void;
  onScheduleRepost: () => void;
  /** Extra wrapper classes (e.g. card padding on mobile). */
  className?: string;
}

export function LookupPrimaryActions({
  onScheduleQuote,
  onScheduleRepost,
  className = "",
}: LookupPrimaryActionsProps) {
  return (
    <div className={`stack-tight ${className}`.trim()}>
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
    </div>
  );
}
