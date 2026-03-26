/**
 * Post viewer (search result) – layout aligned with Primal: author, content, media, stats, actions.
 */

import { Link, useRouteLoaderData } from "@remix-run/react";
import {
  Copy,
  ExternalLink,
  MessageCircle,
  Quote,
  Repeat,
  User,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import {
  eventUrl,
  getNostrClientConfig,
  getNostrClientDisplayName,
} from "~/lib/nostr-client-urls";

import { SearchReplyThread, type SearchReplyItem } from "./SearchReplyThread";

function truncateEventId(id: string, head = 12, tail = 8): string {
  if (id.length <= head + tail + 3) return id;
  return `${id.slice(0, head)}...${id.slice(-tail)}`;
}

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
  /** Top-level thread replies (oldest first); expand rows to load nested replies. */
  replies: SearchReplyItem[];
  onClear: () => void;
  onScheduleQuote: () => void;
  onScheduleRepost: () => void;
}

export function SearchResult({
  result,
  stats,
  replies,
  onClear,
  onScheduleQuote,
  onScheduleRepost,
}: SearchResultProps) {
  const { formatDate } = useFormattedDate();
  const [copied, setCopied] = useState(false);
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
        } | null;
      }
    | undefined;
  const nostrClientConfig = useMemo(
    () =>
      getNostrClientConfig(
        rootData?.user?.preferredNostrClient,
        rootData?.user?.customNostrClientBaseUrl
      ),
    [
      rootData?.user?.preferredNostrClient,
      rootData?.user?.customNostrClientBaseUrl,
    ]
  );
  const viewEventLabel = getNostrClientDisplayName(
    rootData?.user?.preferredNostrClient
  );
  const displayName =
    result.authorName.trim() || `${result.pubkey.slice(0, 8)}...`;

  const copyEventId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(result.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [result.id]);

  return (
    <div className="bg-card dark:border-border border-border rounded-lg border bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Post</h2>
        <button
          onClick={onClear}
          type="button"
          className="dark:text-muted-foreground dark:hover:text-foreground text-muted-foreground hover:text-muted-foreground text-sm"
        >
          View another
        </button>
      </div>

      {/* Author – Primal-style lead */}
      <div className="mb-4 flex items-center gap-3">
        {result.authorImage ? (
          <img
            src={result.authorImage}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-12 w-12 shrink-0 items-center justify-center rounded-full">
            <User
              className="h-6 w-6"
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold">{displayName}</p>
          <p className="text-muted-foreground dark:text-foreground text-xs">
            {formatDate(result.created_at * 1000, {
              isUnixTimestamp: false,
            })}{" "}
            · Kind {result.kind}
          </p>
        </div>
      </div>

      {/* Post content – prominent like Primal */}
      {result.content ? (
        <div className="mb-4">
          <p className="dark:text-foreground text-foreground text-base leading-relaxed break-words whitespace-pre-wrap">
            {result.content}
          </p>
        </div>
      ) : null}

      {/* Media – prominent; single image large, multiple as grid */}
      {result.mediaUrls.length > 0 ? (
        <div className="mb-4">
          {result.mediaUrls.length === 1 ? (
            <img
              src={result.mediaUrls[0]}
              alt="Post media"
              className="max-h-[420px] w-full rounded-lg object-contain"
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              {result.mediaUrls.slice(0, 6).map((url, index) => (
                <img
                  // eslint-disable-next-line react/no-array-index-key -- Stable list of media URLs
                  key={index}
                  src={url}
                  alt={`Media ${index + 1}`}
                  className="h-40 w-full rounded-lg object-cover md:h-48"
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

      {/* Engagement stats */}
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

      {/* Thread: top-level replies; chevron loads nested replies on demand */}
      {replies.length > 0 ? (
        <div className="mb-4">
          <div className="mb-1 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <div className="flex items-center gap-2">
              <MessageCircle
                className="text-muted-foreground h-4 w-4 shrink-0"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
              <h3 className="text-foreground text-sm font-semibold">
                Thread ({replies.length} top-level)
              </h3>
            </div>
            <p className="text-muted-foreground text-xs sm:ml-1">
              Expand a reply to load its nested replies (not fetched until you
              open it).
            </p>
          </div>
          <div className="dark:border-border max-h-[min(70vh,640px)] overflow-y-auto rounded-lg border p-3">
            <SearchReplyThread
              rootReplies={replies}
              nostrClientConfig={nostrClientConfig}
              formatDate={formatDate}
            />
          </div>
        </div>
      ) : null}

      {/* Event ID – truncated + copy */}
      <div className="mb-4">
        <p className="dark:text-muted-foreground text-muted-foreground mb-1 text-xs font-semibold">
          Event ID
        </p>
        <div className="dark:bg-card bg-muted flex items-center gap-2 rounded p-2">
          <code className="dark:text-foreground min-w-0 flex-1 truncate text-xs">
            {truncateEventId(result.id)}
          </code>
          <button
            type="button"
            onClick={() => {
              void copyEventId();
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 rounded p-1 transition-colors"
            title="Copy full event ID"
          >
            <Copy className="h-4 w-4" strokeWidth={INLINE_ICON_STROKE} />
          </button>
        </div>
        {copied ? (
          <p className="text-muted-foreground mt-1 text-xs">Copied</p>
        ) : null}
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

        <Link
          to={eventUrl(result.id, nostrClientConfig)}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-card dark:border-border dark:text-foreground dark:hover:border-border dark:hover:text-foreground dark:focus:ring-ring/40 dark:active:border-border border-border text-foreground hover:border-border hover:text-foreground focus:ring-ring/25 active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none"
        >
          <ExternalLink
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          View on {viewEventLabel}
        </Link>
      </div>
    </div>
  );
}
