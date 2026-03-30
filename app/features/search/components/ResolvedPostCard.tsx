import { Link } from "@remix-run/react";
import { ExternalLink, User } from "lucide-react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import type { NostrClientConfig } from "~/lib/nostr-client-urls";
import { eventUrl } from "~/lib/nostr-client-urls";
import { cn } from "~/lib/utils";

import { stripRenderedMediaUrlsFromNoteText } from "../utils/strip-note-media-urls";

export interface ResolvedPostCardData {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  authorName: string;
  authorImage: string | null;
  mediaUrls: string[];
}

export interface ResolvedPostCardProps {
  result: ResolvedPostCardData;
  nostrClientConfig: NostrClientConfig;
  viewEventLabel: string;
  className?: string;
}

export function ResolvedPostCard({
  result,
  nostrClientConfig,
  viewEventLabel,
  className,
}: ResolvedPostCardProps) {
  const { formatDate } = useFormattedDate();
  const displayName =
    result.authorName.trim() || `${result.pubkey.slice(0, 8)}...`;
  const bodyDisplay = stripRenderedMediaUrlsFromNoteText(
    result.content,
    result.mediaUrls
  );
  const showMediaAttachedFallback =
    !bodyDisplay.trim() && result.mediaUrls.length > 0;

  return (
    <article
      className={cn(
        "border-border bg-card overflow-hidden rounded-xl border shadow-sm",
        className
      )}
    >
      <header className="border-border flex items-start gap-3 border-b px-4 py-3">
        {result.authorImage ? (
          <img
            src={result.authorImage}
            alt=""
            className="h-10 w-10 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <User
              className={INLINE_ICON_SIZE_CLASS}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-foreground text-sm font-semibold">
              {displayName}
            </span>
            <span className="text-muted-foreground text-xs">
              {formatDate(result.created_at * 1000, {
                isUnixTimestamp: false,
              })}{" "}
              · Kind {result.kind}
            </span>
          </div>
        </div>
        <Link
          to={eventUrl(result.id, nostrClientConfig)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground shrink-0 rounded-md p-1.5"
          title={`View on ${viewEventLabel}`}
        >
          <ExternalLink
            className="h-4 w-4"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        </Link>
      </header>

      <div className="px-4 py-3">
        {showMediaAttachedFallback ? (
          <p className="text-muted-foreground mb-2 text-sm italic">
            Media attached
          </p>
        ) : bodyDisplay ? (
          <p className="text-foreground text-[15px] leading-relaxed break-words whitespace-pre-wrap">
            {bodyDisplay}
          </p>
        ) : null}

        {result.mediaUrls.length > 0 ? (
          <div className="mt-3">
            {result.mediaUrls.length === 1 ? (
              <img
                src={result.mediaUrls[0]}
                alt="Post media"
                className="border-border mx-auto max-h-[min(360px,55vh)] w-full rounded-lg border object-contain"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {result.mediaUrls.slice(0, 6).map((url, index) => (
                  <img
                    // eslint-disable-next-line react/no-array-index-key -- Stable list of media URLs
                    key={index}
                    src={url}
                    alt={`Media ${index + 1}`}
                    className="border-border h-36 w-full rounded-lg border object-cover sm:h-40"
                  />
                ))}
              </div>
            )}
            {result.mediaUrls.length > 6 ? (
              <p className="text-muted-foreground mt-2 text-xs">
                +{result.mediaUrls.length - 6} more
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
