/**
 * Thread tree: top-level replies from search loader; nested replies load on expand.
 */

import { Link, useFetcher } from "@remix-run/react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  User,
} from "lucide-react";
import { startTransition, useCallback, useEffect, useState } from "react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import type { NostrClientConfig } from "~/lib/nostr-client-urls";
import { eventUrl } from "~/lib/nostr-client-urls";
import { validateSearchReplies } from "~/lib/validation/search-result";

function truncateEventId(id: string, head = 12, tail = 6): string {
  if (id.length <= head + tail + 3) return id;
  return `${id.slice(0, head)}...${id.slice(-tail)}`;
}

export interface SearchReplyItem {
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
  authorName: string;
  authorImage: string | null;
  mediaUrls?: string[];
}

interface SearchReplyThreadProps {
  rootReplies: SearchReplyItem[];
  nostrClientConfig: NostrClientConfig;
  formatDate: (
    date: Date | number,
    options?: { isUnixTimestamp?: boolean }
  ) => string;
}

const MAX_INDENT_STEPS = 10;
const INDENT_REM = 0.75;

export function SearchReplyThread({
  rootReplies,
  nostrClientConfig,
  formatDate,
}: SearchReplyThreadProps) {
  const fetcher = useFetcher<{
    replies?: unknown;
    error?: string;
  }>();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [cache, setCache] = useState<Map<string, SearchReplyItem[]>>(
    () => new Map()
  );
  const [loadingFor, setLoadingFor] = useState<string | null>(null);

  const requestChildren = useCallback(
    (parentId: string) => {
      const norm = parentId.toLowerCase();
      setLoadingFor(norm);
      const q = `/api/search/thread-replies?parent_event_id=${encodeURIComponent(norm)}`;
      fetcher.load(q);
    },
    [fetcher]
  );

  useEffect(() => {
    if (fetcher.state !== "idle") return;
    const raw = fetcher.data;
    if (!raw || typeof raw !== "object") return;
    const parent = (raw as { parent_event_id?: unknown }).parent_event_id;
    if (typeof parent !== "string" || !parent) return;

    const parentNorm = parent.toLowerCase();
    const parsed = validateSearchReplies(
      (raw as { replies?: unknown }).replies
    );
    startTransition(() => {
      setCache((prev) => {
        const next = new Map(prev);
        next.set(parentNorm, parsed ?? []);
        return next;
      });
      setLoadingFor((cur) => (cur === parentNorm ? null : cur));
    });
  }, [fetcher.state, fetcher.data]);

  const toggleBranch = useCallback(
    (parentId: string) => {
      const norm = parentId.toLowerCase();
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(norm)) {
          next.delete(norm);
          return next;
        }
        next.add(norm);
        if (!cache.has(norm)) {
          requestChildren(norm);
        }
        return next;
      });
    },
    [cache, requestChildren]
  );

  const renderReply = (reply: SearchReplyItem, depth: number) => {
    const replyKey = reply.id.toLowerCase();
    const indentSteps = Math.min(depth, MAX_INDENT_STEPS);
    const isOpen = expanded.has(replyKey);
    const children = cache.get(replyKey);
    const isLoadingThis = loadingFor === replyKey;
    const replyName =
      reply.authorName.trim() || `${reply.pubkey.slice(0, 8)}...`;

    return (
      <li
        key={`${replyKey}-${reply.pubkey}-${depth}`}
        className="border-border border-b pb-3 last:border-b-0 last:pb-0"
      >
        <div
          className="flex gap-2"
          style={{ marginLeft: `${indentSteps * INDENT_REM}rem` }}
        >
          <button
            type="button"
            onClick={() => {
              toggleBranch(replyKey);
            }}
            className="text-muted-foreground hover:text-foreground mt-1 shrink-0 rounded p-0.5"
            aria-expanded={isOpen}
            title={
              isOpen ? "Hide nested replies" : "Load or show nested replies"
            }
          >
            {isLoadingThis && !cache.has(replyKey) ? (
              <Loader2
                className="h-4 w-4 animate-spin"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            ) : isOpen ? (
              <ChevronDown
                className="h-4 w-4"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            ) : (
              <ChevronRight
                className="h-4 w-4"
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex gap-3">
              {reply.authorImage ? (
                <img
                  src={reply.authorImage}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <User
                    className="h-4 w-4"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0">
                  <span className="text-foreground text-sm font-medium">
                    {replyName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatDate(reply.created_at * 1000, {
                      isUnixTimestamp: false,
                    })}
                  </span>
                </div>
                {reply.content ? (
                  <p className="text-foreground mb-2 text-sm leading-relaxed break-words whitespace-pre-wrap">
                    {reply.content}
                  </p>
                ) : null}
                {reply.mediaUrls && reply.mediaUrls.length > 0 ? (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {reply.mediaUrls.slice(0, 3).map((url, index) => (
                      <img
                        // eslint-disable-next-line react/no-array-index-key -- URL list from note
                        key={index}
                        src={url}
                        alt=""
                        className="h-16 max-w-[120px] rounded object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    to={eventUrl(reply.id, nostrClientConfig)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <ExternalLink
                      className="h-3 w-3"
                      strokeWidth={INLINE_ICON_STROKE}
                      aria-hidden
                    />
                    View
                  </Link>
                  <code className="text-muted-foreground max-w-full truncate text-[10px]">
                    {truncateEventId(reply.id)}
                  </code>
                </div>
              </div>
            </div>

            {isOpen ? (
              <div className="mt-3">
                {isLoadingThis && !cache.has(replyKey) ? (
                  <p className="text-muted-foreground pl-6 text-xs">
                    Loading replies…
                  </p>
                ) : children && children.length > 0 ? (
                  <ul className="border-border ml-1 space-y-3 border-l border-dashed pl-2">
                    {children.map((child) => renderReply(child, depth + 1))}
                  </ul>
                ) : cache.has(replyKey) ? (
                  <p className="text-muted-foreground pl-6 text-xs">
                    No nested replies loaded for this note.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </li>
    );
  };

  return (
    <ul
      className="space-y-3"
      aria-label="Thread: top-level replies; expand rows for nested replies"
    >
      {rootReplies.map((reply) => renderReply(reply, 0))}
    </ul>
  );
}
