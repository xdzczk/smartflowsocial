import { formatDistanceToNow } from "date-fns";
import { Copy, RefreshCw } from "lucide-react";
import { nip19 } from "nostr-tools";
import { useCallback, useMemo, useState } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { SearchLookupResolution } from "~/features/search";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { ResolvedPostCardData } from "./ResolvedPostCard";

function truncateMiddle(s: string, head = 14, tail = 10): string {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function encodeClipboardBech(
  hexId: string,
  identifierKind: SearchLookupResolution["identifierKind"]
): string | null {
  try {
    if (identifierKind === "nevent") {
      return nip19.neventEncode({ id: hexId });
    }
    return nip19.noteEncode(hexId);
  } catch {
    return null;
  }
}

export interface LookupResultHeaderProps {
  result: Pick<
    ResolvedPostCardData,
    "id" | "pubkey" | "created_at" | "kind" | "authorName" | "authorImage"
  >;
  resolution: SearchLookupResolution | null;
  /** Raw query param (what user pasted), for context. */
  queryLabel?: string | null;
  onNewLookup: () => void;
  onRetry?: () => void;
  className?: string;
}

export function LookupResultHeader({
  result,
  resolution,
  queryLabel,
  onNewLookup,
  onRetry,
  className,
}: LookupResultHeaderProps) {
  const { formatDate } = useFormattedDate();
  const [copied, setCopied] = useState<string | null>(null);
  const flash = useCallback((key: string) => {
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const displayName =
    result.authorName.trim() || `${result.pubkey.slice(0, 8)}…`;
  const npubFull = useMemo(() => {
    try {
      return nip19.npubEncode(result.pubkey);
    } catch {
      return null;
    }
  }, [result.pubkey]);
  const npubShort = npubFull ? truncateMiddle(npubFull, 12, 8) : null;

  const bechForCopy = useMemo(() => {
    const kind = resolution?.identifierKind ?? "hex";
    return encodeClipboardBech(result.id, kind);
  }, [result.id, resolution?.identifierKind]);

  const created = new Date(result.created_at * 1000);
  const relative = formatDistanceToNow(created, { addSuffix: true });
  const absolute = formatDate(result.created_at * 1000, {
    isUnixTimestamp: false,
  });

  const statusChip = useMemo(() => {
    if (!resolution) {
      return { label: "Resolved", variant: "secondary" as const };
    }
    if (resolution.status === "partial") {
      return { label: "Partially resolved", variant: "outline" as const };
    }
    return { label: "Fully resolved", variant: "secondary" as const };
  }, [resolution]);

  const metaLine = resolution?.labels.slice(0, 3).join(" · ") ?? "";

  const copyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.id);
      flash("id");
    } catch {
      flash("id");
    }
  }, [flash, result.id]);

  const copyBech = useCallback(async () => {
    if (!bechForCopy) return;
    try {
      await navigator.clipboard.writeText(bechForCopy);
      flash("bech");
    } catch {
      flash("bech");
    }
  }, [bechForCopy, flash]);

  return (
    <div
      className={cn(
        "border-border bg-surface shadow-1 flex flex-col gap-3 rounded-xl border px-4 py-3 sm:min-h-[72px] sm:flex-row sm:items-center sm:justify-between sm:gap-4",
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Badge variant="default" className="shrink-0 font-medium">
          Post
        </Badge>
        {result.authorImage ? (
          <img
            src={result.authorImage}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="bg-surface-hover h-10 w-10 shrink-0 rounded-full" />
        )}
        <div className="min-w-0">
          <p className="text-text truncate text-sm font-semibold">
            {displayName}
          </p>
          {npubShort ? (
            <p className="text-text-secondary font-mono text-xs">{npubShort}</p>
          ) : null}
          {queryLabel ? (
            <p className="text-text-secondary mt-0.5 truncate text-[11px]">
              Searched: {truncateMiddle(queryLabel, 24, 12)}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-[1.1] flex-col gap-1 sm:px-2">
        <div className="text-text-secondary flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span>Kind {result.kind}</span>
          <span className="text-border">·</span>
          <span title={absolute}>{absolute}</span>
          <span className="text-border">·</span>
          <span className="text-text-secondary/90">{relative}</span>
        </div>
        {metaLine ? (
          <p className="text-text-secondary line-clamp-2 text-[11px] leading-snug">
            {metaLine}
          </p>
        ) : null}
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          <Badge
            variant={statusChip.variant}
            className="text-[10px] font-medium"
          >
            {statusChip.label}
          </Badge>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-1 sm:flex-col sm:items-stretch">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 text-xs"
          onClick={() => {
            void copyId();
          }}
          title="Copy event id (hex)"
        >
          <Copy
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          {copied === "id" ? "Copied" : "ID"}
        </Button>
        {bechForCopy ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => {
              void copyBech();
            }}
            title="Copy note / nevent"
          >
            <Copy
              className={INLINE_ICON_SIZE_CLASS}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            {copied === "bech" ? "Copied" : "Bech32"}
          </Button>
        ) : null}
        {onRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={onRetry}
          >
            <RefreshCw
              className={INLINE_ICON_SIZE_CLASS}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
            Retry
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={onNewLookup}
        >
          New lookup
        </Button>
      </div>
    </div>
  );
}
