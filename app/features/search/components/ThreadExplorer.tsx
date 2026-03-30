import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import type { NostrClientConfig } from "~/lib/nostr-client-urls";

import { SearchReplyThread, type SearchReplyItem } from "./SearchReplyThread";

export interface ThreadExplorerProps {
  replies: SearchReplyItem[];
  nostrClientConfig: NostrClientConfig;
  formatDate: (
    date: Date | number,
    options?: { isUnixTimestamp?: boolean }
  ) => string;
  topLevelCount?: number;
}

export function ThreadExplorer({
  replies,
  nostrClientConfig,
  formatDate,
  topLevelCount,
}: ThreadExplorerProps) {
  const [expandAllTopBodies, setExpandAllTopBodies] = useState(false);
  const n = topLevelCount ?? replies.length;

  if (replies.length === 0) {
    return null;
  }

  return (
    <section className="border-border bg-card rounded-xl border shadow-sm">
      <div className="border-border flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle
              className="text-muted-foreground h-4 w-4 shrink-0"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            <h3 className="text-foreground text-sm font-semibold">
              Thread · {n} top-level {n === 1 ? "reply" : "replies"}
            </h3>
          </div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Nested replies load on demand.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setExpandAllTopBodies((v) => !v);
            }}
          >
            {expandAllTopBodies ? (
              <>
                <ChevronUp className="mr-1 h-3.5 w-3.5" aria-hidden />
                Collapse top-level text
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3.5 w-3.5" aria-hidden />
                Expand all top-level
              </>
            )}
          </Button>
        </div>
      </div>
      <div className="max-h-[min(70vh,640px)] overflow-y-auto p-3">
        <SearchReplyThread
          rootReplies={replies}
          nostrClientConfig={nostrClientConfig}
          formatDate={formatDate}
          expandAllTopLevelBodies={expandAllTopBodies}
        />
      </div>
    </section>
  );
}
