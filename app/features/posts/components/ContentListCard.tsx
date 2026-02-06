import { Link } from "@remix-run/react";
import { useRef, useState, useEffect } from "react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";

import type {
  CombinedContent,
  LongFormPostData,
  PostData,
  PostFetcher,
} from "../types";
import {
  formatDate,
  getContentPreview,
  getContentTitle,
  getQueueTypeDisplay,
  getStatusColor,
  getStatusText,
} from "../utils/content-helpers";

function getFetcherFormData(
  fetcher: PostFetcher | undefined
): FormData | null | undefined {
  return (fetcher as { formData?: FormData | null }).formData;
}

function getFirstImageUrl(item: CombinedContent): string | null {
  if (item.type === "longform" && item.image) {
    return item.image;
  }
  const fileUrl = item.fileUrl;
  if (!fileUrl || fileUrl.length === 0) return null;
  const first = fileUrl[0];
  if (typeof first === "string") {
    try {
      const parsed = JSON.parse(first) as string[] | string;
      return Array.isArray(parsed) ? (parsed[0] ?? null) : parsed;
    } catch {
      return first;
    }
  }
  return null;
}

export interface ContentListCardProps {
  item: CombinedContent;
  type: "scheduled" | "draft" | "posted";
  userTimezone?: string;
  userTimeFormat?: "12h" | "24h";
  showBulkActions: boolean;
  selectedItems: Set<string>;
  onToggleSelection?: (id: string) => void;
  onPostSelect?: (content: CombinedContent) => void;
  onEditPost?: (post: PostData | LongFormPostData) => void;
  onReschedulePost?: (post: PostData | LongFormPostData) => void;
  deleteFetcher: PostFetcher;
  individualRepostFetcher?: PostFetcher;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
}

// Card and dropdown mirror ContentTableRow actions; refactor into subcomponents in a follow-up
// eslint-disable-next-line sonarjs/cognitive-complexity -- action menu branches by type (posted/scheduled/draft) and content (post/longform)
export function ContentListCard({
  item,
  type,
  userTimezone,
  userTimeFormat = "12h",
  showBulkActions,
  selectedItems,
  onToggleSelection,
  onPostSelect,
  onEditPost,
  onReschedulePost,
  deleteFetcher,
  individualRepostFetcher,
  longformRepostFetcher,
  longformQuoteFetcher,
  onScheduleRepost,
  onScheduleQuote,
}: ContentListCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuOpen]);

  const queueDisplay = getQueueTypeDisplay(item.queueType);
  const firstImage = getFirstImageUrl(item);

  const dateLabel =
    type === "scheduled"
      ? formatDate(
          item.scheduledAtUtc ?? undefined,
          false,
          userTimezone,
          userTimeFormat
        )
      : type === "posted"
        ? formatDate(item.postedAt, false, userTimezone, userTimeFormat)
        : formatDate(item.createdAt, false, userTimezone, userTimeFormat);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onPostSelect?.(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPostSelect?.(item);
        }
      }}
      className="border-border bg-card hover:bg-muted/50 flex cursor-pointer items-stretch gap-3 rounded-lg border p-3 text-left shadow-sm transition-colors"
      aria-label={`${getContentTitle(item)}, ${dateLabel}`}
    >
      {showBulkActions ? (
        <div
          className="flex flex-shrink-0 items-center"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.stopPropagation();
            }
          }}
          role="none"
        >
          <input
            id={`content-list-select-${item.id}`}
            name={`content-list-select-${item.id}`}
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => onToggleSelection?.(item.id)}
            className="border-border accent-checkbox focus:ring-ring h-4 w-4 rounded"
          />
        </div>
      ) : null}
      <div className="flex h-14 w-14 flex-shrink-0 overflow-hidden rounded-md">
        {firstImage ? (
          <MediaThumbnail
            src={firstImage}
            alt=""
            className="h-full w-full object-cover"
            fallback={
              <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium">
                {item.type === "post" ? "TEXT" : "ART"}
              </div>
            }
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium">
            {item.type === "post" ? "TEXT" : "ART"}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{getContentTitle(item)}</p>
        <p className="text-muted-foreground truncate text-xs">
          {getContentPreview(item)?.slice(0, 40) ?? ""}
          {(getContentPreview(item)?.length ?? 0) > 40 ? "…" : ""}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-muted-foreground">{dateLabel}</span>
          <span className={queueDisplay.className} style={queueDisplay.style}>
            {queueDisplay.name}
          </span>
          <span
            className={`inline-flex rounded-full border border-transparent px-1.5 py-0.5 text-[10px] font-semibold ${getStatusColor(item)}`}
          >
            {getStatusText(item)}
          </span>
        </div>
      </div>
      <div className="relative flex-shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((open) => !open);
          }}
          className="text-muted-foreground hover:text-foreground focus:ring-ring flex h-8 w-8 items-center justify-center rounded-md focus:ring-2 focus:ring-offset-0 focus:outline-none"
          aria-label="Actions"
          aria-expanded={menuOpen}
        >
          <span className="text-lg leading-none">⋯</span>
        </button>
        {menuOpen ? (
          <div
            className="border-border bg-card absolute top-full right-0 z-10 mt-1 min-w-[10rem] rounded-lg border py-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
              }
            }}
            role="none"
          >
            {type === "posted" ? (
              <>
                {item.type === "post" && item.originalData.signedEvent?.id ? (
                  <Link
                    to={`https://primal.net/e/${item.originalData.signedEvent.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground hover:bg-muted block px-3 py-2 text-sm"
                  >
                    View Note
                  </Link>
                ) : null}
                {item.type === "longform" &&
                (item.originalData.nostrEventId ||
                  item.originalData.signedEvent?.id) ? (
                  <Link
                    to={`https://primal.net/a/${item.originalData.nostrEventId ?? item.originalData.signedEvent?.id ?? ""}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-foreground hover:bg-muted block px-3 py-2 text-sm"
                  >
                    View Article
                  </Link>
                ) : null}
                {item.type === "post" && individualRepostFetcher ? (
                  <>
                    <individualRepostFetcher.Form method="post">
                      <input type="hidden" name="postId" value={item.id} />
                      <input type="hidden" name="_action" value="repost" />
                      <button
                        type="submit"
                        disabled={
                          individualRepostFetcher.state !== "idle" ||
                          (getFetcherFormData(individualRepostFetcher)
                            ? (getFetcherFormData(individualRepostFetcher)!.get(
                                "postId"
                              ) as string | null) === item.id
                            : false)
                        }
                        className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm disabled:opacity-50"
                      >
                        {individualRepostFetcher.state !== "idle" &&
                        (getFetcherFormData(individualRepostFetcher)
                          ? (getFetcherFormData(individualRepostFetcher)!.get(
                              "postId"
                            ) as string | null) === item.id
                          : false)
                          ? "Reposting..."
                          : "Repost"}
                      </button>
                    </individualRepostFetcher.Form>
                    <individualRepostFetcher.Form method="post">
                      <input type="hidden" name="postId" value={item.id} />
                      <input type="hidden" name="_action" value="quote" />
                      <button
                        type="submit"
                        disabled={
                          individualRepostFetcher.state !== "idle" ||
                          (getFetcherFormData(individualRepostFetcher)
                            ? (getFetcherFormData(individualRepostFetcher)!.get(
                                "postId"
                              ) as string | null) === item.id
                            : false)
                        }
                        className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm disabled:opacity-50"
                      >
                        {individualRepostFetcher.state !== "idle" &&
                        (getFetcherFormData(individualRepostFetcher)
                          ? (getFetcherFormData(individualRepostFetcher)!.get(
                              "postId"
                            ) as string | null) === item.id
                          : false)
                          ? "Quoting..."
                          : "Quote Post"}
                      </button>
                    </individualRepostFetcher.Form>
                  </>
                ) : null}
                {item.type === "longform" && longformRepostFetcher ? (
                  <longformRepostFetcher.Form method="post">
                    <input type="hidden" name="postId" value={item.id} />
                    <input
                      type="hidden"
                      name="_action"
                      value="longformRepost"
                    />
                    <button
                      type="submit"
                      disabled={
                        longformRepostFetcher.state !== "idle" ||
                        (getFetcherFormData(longformRepostFetcher)
                          ? (getFetcherFormData(longformRepostFetcher)!.get(
                              "postId"
                            ) as string | null) === item.id
                          : false)
                      }
                      className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm disabled:opacity-50"
                    >
                      {longformRepostFetcher.state !== "idle" &&
                      (getFetcherFormData(longformRepostFetcher)
                        ? (getFetcherFormData(longformRepostFetcher)!.get(
                            "postId"
                          ) as string | null) === item.id
                        : false)
                        ? "Reposting..."
                        : "Repost"}
                    </button>
                  </longformRepostFetcher.Form>
                ) : null}
                {item.type === "longform" && longformQuoteFetcher ? (
                  <longformQuoteFetcher.Form method="post">
                    <input type="hidden" name="postId" value={item.id} />
                    <input type="hidden" name="_action" value="longformQuote" />
                    <button
                      type="submit"
                      disabled={
                        longformQuoteFetcher.state !== "idle" ||
                        (getFetcherFormData(longformQuoteFetcher)
                          ? (getFetcherFormData(longformQuoteFetcher)!.get(
                              "postId"
                            ) as string | null) === item.id
                          : false)
                      }
                      className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm disabled:opacity-50"
                    >
                      {longformQuoteFetcher.state !== "idle" &&
                      (getFetcherFormData(longformQuoteFetcher)
                        ? (getFetcherFormData(longformQuoteFetcher)!.get(
                            "postId"
                          ) as string | null) === item.id
                        : false)
                        ? "Quoting..."
                        : "Quote Post"}
                    </button>
                  </longformQuoteFetcher.Form>
                ) : null}
                {onScheduleRepost && item.type === "post" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onScheduleRepost(item.originalData as PostData);
                      setMenuOpen(false);
                    }}
                    className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                  >
                    Schedule repost
                  </button>
                ) : null}
                {onScheduleQuote && item.type === "post" ? (
                  <button
                    type="button"
                    onClick={() => {
                      onScheduleQuote(item.originalData as PostData);
                      setMenuOpen(false);
                    }}
                    className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                  >
                    Schedule quote
                  </button>
                ) : null}
              </>
            ) : null}
            {type === "scheduled" ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onEditPost?.(item.originalData);
                    setMenuOpen(false);
                  }}
                  className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onReschedulePost?.(item.originalData);
                    setMenuOpen(false);
                  }}
                  className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                >
                  Reschedule
                </button>
                {item.type === "post" && onScheduleRepost ? (
                  <button
                    type="button"
                    onClick={() => {
                      onScheduleRepost(item.originalData as PostData);
                      setMenuOpen(false);
                    }}
                    className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                  >
                    Schedule repost
                  </button>
                ) : null}
                {item.type === "post" && onScheduleQuote ? (
                  <button
                    type="button"
                    onClick={() => {
                      onScheduleQuote(item.originalData as PostData);
                      setMenuOpen(false);
                    }}
                    className="text-foreground hover:bg-muted block w-full px-3 py-2 text-left text-sm"
                  >
                    Schedule quote
                  </button>
                ) : null}
              </>
            ) : null}
            <deleteFetcher.Form method="post">
              <input type="hidden" name="postId" value={item.id} />
              <input
                type="hidden"
                name="_action"
                value={item.type === "post" ? "delete" : "deleteLongForm"}
              />
              <button
                type="submit"
                disabled={deleteFetcher.state !== "idle"}
                className="text-destructive hover:bg-muted block w-full px-3 py-2 text-left text-sm disabled:opacity-50"
              >
                {deleteFetcher.state !== "idle" &&
                (deleteFetcher.formData
                  ? (deleteFetcher.formData.get("postId") as string | null) ===
                    item.id
                  : false)
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </deleteFetcher.Form>
          </div>
        ) : null}
      </div>
    </div>
  );
}
