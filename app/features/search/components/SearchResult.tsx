/**
 * Search result component
 */

import { ExternalLink, Quote, Repeat, User } from "lucide-react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
interface SearchResultData {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  content: string;
  tags: string[][];
  authorName: string;
  authorImage: string | null;
  mediaUrls: string[];
}

interface SearchStats {
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}

interface SearchResultProps {
  result: SearchResultData;
  stats: SearchStats | null;
  onClear: () => void;
  onScheduleQuote: () => void;
  onScheduleRepost: () => void;
}

export function SearchResult({
  result,
  stats,
  onClear,
  onScheduleQuote,
  onScheduleRepost,
}: SearchResultProps) {
  const { formatDate } = useFormattedDate();

  return (
    <div className="bg-card dark:border-border border-border rounded-lg border bg-white p-6">
      {/* Clear button */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Search Result</h2>
        <button
          onClick={onClear}
          className="dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-muted-foreground text-sm"
        >
          Clear
        </button>
      </div>

      {/* Author Info */}
      <div className="mb-4 flex items-center gap-3">
        {result.authorImage ? (
          <img
            src={result.authorImage}
            alt={result.authorName}
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded-full">
            <User
              className="h-6 w-6"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        )}
        <div>
          <p className="font-semibold">{result.authorName}</p>
          <p className="text-muted-foreground dark:text-foreground text-xs">
            {formatDate(result.created_at * 1000, {
              isUnixTimestamp: false,
            })}{" "}
            • Kind {result.kind}
          </p>
        </div>
      </div>

      {/* Media Preview */}
      {result.mediaUrls.length > 0 ? (
        <div className="mb-4">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {result.mediaUrls.slice(0, 6).map((url, index) => (
              <img
                // eslint-disable-next-line react/no-array-index-key -- Stable list of media URLs, no unique ID available
                key={index}
                src={url}
                alt={`Media ${index + 1}`}
                className="h-32 w-full rounded object-cover"
              />
            ))}
          </div>
          {result.mediaUrls.length > 6 ? (
            <p className="text-muted-foreground mt-2 text-xs">
              +{result.mediaUrls.length - 6} more media files
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Content */}
      <div className="mb-4">
        <p className="dark:text-foreground text-muted-foreground text-sm whitespace-pre-wrap">
          {result.content}
        </p>
      </div>

      {/* Engagement Stats */}
      {stats ? (
        <div className="dark:bg-card bg-muted mb-4 grid grid-cols-3 gap-4 rounded-lg p-4 md:grid-cols-6">
          <div className="text-center">
            <p className="dark:text-muted-foreground text-muted-foreground text-xs">
              Likes
            </p>
            <p className="text-lg font-semibold">{stats.likes}</p>
          </div>
          <div className="text-center">
            <p className="dark:text-muted-foreground text-muted-foreground text-xs">
              Replies
            </p>
            <p className="text-lg font-semibold">{stats.replies}</p>
          </div>
          <div className="text-center">
            <p className="dark:text-muted-foreground text-muted-foreground text-xs">
              Reposts
            </p>
            <p className="text-lg font-semibold">{stats.reposts}</p>
          </div>
          <div className="text-center">
            <p className="dark:text-muted-foreground text-muted-foreground text-xs">
              Zaps
            </p>
            <p className="text-lg font-semibold">{stats.zaps}</p>
          </div>
          <div className="text-center">
            <p className="dark:text-muted-foreground text-muted-foreground text-xs">
              Mentions
            </p>
            <p className="text-lg font-semibold">{stats.mentions}</p>
          </div>
          <div className="text-center">
            <p className="dark:text-muted-foreground text-muted-foreground text-xs">
              Sats
            </p>
            <p className="text-lg font-semibold">{stats.satszapped}</p>
          </div>
        </div>
      ) : null}

      {/* Event ID */}
      <div className="mb-4">
        <p className="dark:text-muted-foreground text-muted-foreground mb-1 text-xs font-semibold">
          Event ID:
        </p>
        <code className="dark:bg-card dark:text-foreground bg-muted block rounded p-2 text-xs">
          {result.id}
        </code>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onScheduleQuote}
          className="bg-card dark:border-border dark:active:border-border border-success text-success hover:border-success hover:text-success focus:ring-ring/25 active:border-success dark:text-success dark:hover:border-success dark:hover:text-success dark:focus:ring-ring/40 inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
        >
          <Quote
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Schedule Quote Post
        </button>

        <button
          onClick={onScheduleRepost}
          className="bg-card dark:border-border dark:active:border-border border-border text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
        >
          <Repeat
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Schedule Repost (Kind 6)
        </button>

        <a
          href={`https://primal.net/e/${result.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-ring/40 dark:active:border-border border-border text-foreground hover:border-border hover:text-foreground focus:ring-ring/25 active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
        >
          <ExternalLink
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          View on Primal
        </a>
      </div>
    </div>
  );
}
