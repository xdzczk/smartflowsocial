import { Link, useRouteLoaderData } from "@remix-run/react";
import type { FetcherWithComponents } from "@remix-run/react";
import { formatDistanceToNow } from "date-fns";
import { MoreHorizontal, Repeat } from "lucide-react";
import { useMemo } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  getLongFormDraftEditUrl,
  getShortDraftComposeUrl,
} from "~/features/posts/drafts/utils/draft-editor-navigation";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import {
  INLINE_ICON_SIZE_CLASS,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { getNostrClientUrlsFromUser } from "~/lib/nostr-client-urls";

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
  getMediaPreviewUrls,
  getPostRowThumbnailBadge,
  isPureRepostSourceContent,
  isRepostContent,
} from "../utils/content-helpers";

import { CONTENT_LIST_CARD_HEIGHT_PX } from "./constants";
import { MediaPreviewCollage } from "./MediaPreviewCollage";
import { ContentStatusChip, QueueStatusChip } from "./publishing-suite";

function getFetcherFormData(
  fetcher: PostFetcher | undefined
): FormData | null | undefined {
  return (fetcher as { formData?: FormData | null }).formData;
}

export interface ContentListCardProps {
  item: CombinedContent;
  type: "scheduled" | "draft" | "published";
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
  /** Drafts: row tap opens composer/editor instead of details modal */
  onResumeDraft?: () => void;
  /** Drafts: duplicate / convert actions (optional; All tab may omit) */
  draftsActionFetcher?: FetcherWithComponents<{
    success?: boolean;
    newPostId?: string;
    error?: string;
  }>;
  /** Called when the actions menu opens or closes (e.g. so parent can elevate z-index for virtual lists) */
  onMenuOpenChange?: (open: boolean) => void;
  /** Called synchronously before a delete is submitted so the parent can do optimistic cache removal */
  onBeforeDelete?: (postId: string) => void;
  /** When provided, replaces the default deleteFetcher.submit() so the parent controls the full delete lifecycle (including cascade handling). */
  onDelete?: (postId: string, postType: "post" | "longform") => void;
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
  onResumeDraft,
  draftsActionFetcher,
  onMenuOpenChange,
  onBeforeDelete,
  onDelete,
}: ContentListCardProps) {
  const { dateLocale } = useFormattedDate();
  const rootData = useRouteLoaderData("root") as
    | {
        user?: {
          preferredNostrClient?: string;
          customNostrClientBaseUrl?: string | null;
        } | null;
      }
    | undefined;
  const nostrUrls = useMemo(
    () => getNostrClientUrlsFromUser(rootData?.user),
    [rootData?.user]
  );
  const mediaUrls = getMediaPreviewUrls(item, 4);
  const hasMedia = mediaUrls.length > 0;
  const blockRepostQuoteChain = isPureRepostSourceContent(item);
  const thumbnailBadge =
    item.type === "longform"
      ? ("ART" as const)
      : getPostRowThumbnailBadge({
          contentKind: "post",
          postType: item.postType,
          signedEvent: item.signedEvent ?? null,
          repost: isRepostContent(item),
          postKind: item.postKind ?? null,
        });

  const dateLabel =
    type === "scheduled"
      ? formatDate(
          item.scheduledAtUtc ?? undefined,
          false,
          userTimezone,
          userTimeFormat,
          dateLocale
        )
      : type === "published"
        ? formatDate(
            item.publishedAt ?? undefined,
            false,
            userTimezone,
            userTimeFormat,
            dateLocale
          )
        : formatDistanceToNow(item.updatedAt, { addSuffix: true });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (type === "draft" && onResumeDraft) {
          onResumeDraft();
          return;
        }
        onPostSelect?.(item);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (type === "draft" && onResumeDraft) {
            onResumeDraft();
            return;
          }
          onPostSelect?.(item);
        }
      }}
      className="group border-border bg-surface hover:bg-surface-hover/50 shadow-1 flex cursor-pointer items-stretch gap-3 overflow-hidden rounded-lg border p-3 text-left transition-colors"
      style={{
        height: CONTENT_LIST_CARD_HEIGHT_PX,
        minHeight: CONTENT_LIST_CARD_HEIGHT_PX,
      }}
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
          <Checkbox
            id={`content-list-select-${item.id}`}
            checked={selectedItems.has(item.id)}
            onCheckedChange={() => onToggleSelection?.(item.id)}
          />
        </div>
      ) : null}
      <div className="relative h-14 w-14 flex-shrink-0">
        <div className="h-full w-full overflow-hidden rounded-md">
          {hasMedia ? (
            <MediaPreviewCollage
              urls={mediaUrls}
              className="h-full w-full rounded-md"
              thumbnailClassName="h-full w-full object-cover"
              fallback={
                <div className="bg-surface-hover text-text-secondary flex h-full w-full items-center justify-center text-[10px] font-medium">
                  {thumbnailBadge}
                </div>
              }
            />
          ) : (
            <div
              className="bg-surface-hover text-text-secondary flex h-full w-full items-center justify-center text-xs font-medium"
              aria-hidden
            >
              {thumbnailBadge}
            </div>
          )}
        </div>
        {isRepostContent(item) ? (
          <div className="bg-brand absolute -top-0.5 -right-0.5 rounded-full p-0.5">
            <Repeat
              className={`${SMALL_ICON_SIZE_CLASS} text-white`}
              strokeWidth={2}
              aria-hidden
            />
          </div>
        ) : null}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium">{getContentTitle(item)}</p>
        <p className="text-text-secondary truncate text-xs">
          {getContentPreview(item)?.slice(0, 40) ?? ""}
          {(getContentPreview(item)?.length ?? 0) > 40 ? "…" : ""}
        </p>
        <div className="mt-1 flex flex-shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
          <span className="text-text-secondary">{dateLabel}</span>
          <QueueStatusChip
            queueType={item.queueType}
            mode={type === "draft" ? "draft" : "default"}
          />
          {type === "draft" ? null : <ContentStatusChip item={item} />}
        </div>
        {type === "scheduled" && item.dependencyMode === "attached" ? (
          <p className="text-text-secondary mt-1 text-xs">
            Follow-up
            {item.followUpTimingMode === "offset_from_parent"
              ? " · Offset from parent"
              : " · Fixed date/time"}
          </p>
        ) : null}
      </div>
      <DropdownMenu
        onOpenChange={(open) => {
          onMenuOpenChange?.(open);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="text-text-secondary hover:text-text focus-visible:ring-focus-ring flex h-8 w-8 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-offset-0 focus-visible:outline-none"
            aria-label="Actions"
          >
            <MoreHorizontal className={INLINE_ICON_SIZE_CLASS} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {type === "published" ? (
            <>
              {item.type === "post" && item.originalData.signedEvent?.id ? (
                <DropdownMenuItem asChild>
                  <Link
                    to={nostrUrls.eventUrl(item.originalData.signedEvent.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open on Nostr
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {item.type === "longform" &&
              (item.originalData.nostrEventId ||
                item.originalData.signedEvent?.id) ? (
                <DropdownMenuItem asChild>
                  <Link
                    to={nostrUrls.articleUrl(
                      item.originalData.nostrEventId ??
                        item.originalData.signedEvent?.id ??
                        ""
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Article
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {item.type === "post" &&
              individualRepostFetcher &&
              !blockRepostQuoteChain ? (
                <>
                  <individualRepostFetcher.Form method="post">
                    <input type="hidden" name="postId" value={item.id} />
                    <input type="hidden" name="_action" value="repost" />
                    <DropdownMenuItem asChild>
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
                        className="w-full cursor-pointer"
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
                    </DropdownMenuItem>
                  </individualRepostFetcher.Form>
                  <individualRepostFetcher.Form method="post">
                    <input type="hidden" name="postId" value={item.id} />
                    <input type="hidden" name="_action" value="quote" />
                    <DropdownMenuItem asChild>
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
                        className="w-full cursor-pointer"
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
                    </DropdownMenuItem>
                  </individualRepostFetcher.Form>
                </>
              ) : null}
              {item.type === "longform" && longformRepostFetcher ? (
                <longformRepostFetcher.Form method="post">
                  <input type="hidden" name="postId" value={item.id} />
                  <input type="hidden" name="_action" value="longformRepost" />
                  <DropdownMenuItem asChild>
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
                      className="w-full cursor-pointer"
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
                  </DropdownMenuItem>
                </longformRepostFetcher.Form>
              ) : null}
              {item.type === "longform" && longformQuoteFetcher ? (
                <longformQuoteFetcher.Form method="post">
                  <input type="hidden" name="postId" value={item.id} />
                  <input type="hidden" name="_action" value="longformQuote" />
                  <DropdownMenuItem asChild>
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
                      className="w-full cursor-pointer"
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
                  </DropdownMenuItem>
                </longformQuoteFetcher.Form>
              ) : null}
              {onScheduleRepost &&
              item.type === "post" &&
              !blockRepostQuoteChain ? (
                <DropdownMenuItem
                  onSelect={() =>
                    onScheduleRepost(item.originalData as PostData)
                  }
                >
                  Schedule repost
                </DropdownMenuItem>
              ) : null}
              {onScheduleQuote &&
              item.type === "post" &&
              !blockRepostQuoteChain ? (
                <DropdownMenuItem
                  onSelect={() =>
                    onScheduleQuote(item.originalData as PostData)
                  }
                >
                  Schedule quote
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          {type === "scheduled" ? (
            <>
              <DropdownMenuItem
                onSelect={() => onEditPost?.(item.originalData)}
              >
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => onReschedulePost?.(item.originalData)}
              >
                Reschedule
              </DropdownMenuItem>
              {item.type === "post" &&
              onScheduleRepost &&
              !blockRepostQuoteChain ? (
                <DropdownMenuItem
                  onSelect={() =>
                    onScheduleRepost(item.originalData as PostData)
                  }
                >
                  Schedule repost
                </DropdownMenuItem>
              ) : null}
              {item.type === "post" &&
              onScheduleQuote &&
              !blockRepostQuoteChain ? (
                <DropdownMenuItem
                  onSelect={() =>
                    onScheduleQuote(item.originalData as PostData)
                  }
                >
                  Schedule quote
                </DropdownMenuItem>
              ) : null}
            </>
          ) : null}
          {type === "draft" ? (
            <>
              <DropdownMenuItem asChild>
                <Link
                  to={
                    item.type === "longform"
                      ? getLongFormDraftEditUrl(item.id)
                      : getShortDraftComposeUrl(
                          item.id,
                          item.originalData as PostData
                        )
                  }
                >
                  Continue editing
                </Link>
              </DropdownMenuItem>
              {item.type === "post" && draftsActionFetcher ? (
                <>
                  <DropdownMenuItem
                    onSelect={() => {
                      const fd = new FormData();
                      fd.set("_action", "duplicateDraftPost");
                      fd.set("postId", item.id);
                      draftsActionFetcher.submit(fd, {
                        method: "post",
                        action: "/dashboard/drafts",
                      });
                    }}
                  >
                    Duplicate draft
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      const name = window.prompt(
                        "Template name",
                        "Template from draft"
                      );
                      if (name === null) return;
                      const fd = new FormData();
                      fd.set("_action", "convertDraftToTemplate");
                      fd.set("postId", item.id);
                      fd.set("templateName", name);
                      draftsActionFetcher.submit(fd, {
                        method: "post",
                        action: "/dashboard/drafts",
                      });
                    }}
                  >
                    Convert to template
                  </DropdownMenuItem>
                </>
              ) : null}
              <DropdownMenuSeparator />
            </>
          ) : (
            <DropdownMenuSeparator />
          )}
          <DropdownMenuItem
            disabled={deleteFetcher.state !== "idle"}
            className="text-danger w-full cursor-pointer disabled:opacity-50"
            onSelect={() => {
              onBeforeDelete?.(item.id);
              const postType =
                item.type === "post"
                  ? ("post" as const)
                  : ("longform" as const);
              if (onDelete) {
                onDelete(item.id, postType);
              } else {
                const formData = new FormData();
                formData.set("postId", item.id);
                formData.set(
                  "_action",
                  postType === "post" ? "delete" : "deleteLongForm"
                );
                deleteFetcher.submit(formData, { method: "post" });
              }
            }}
          >
            {deleteFetcher.state !== "idle" &&
            (deleteFetcher.formData
              ? (deleteFetcher.formData.get("postId") as string | null) ===
                item.id
              : false)
              ? "Deleting..."
              : type === "draft"
                ? "Delete draft"
                : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
