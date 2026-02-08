import { Link } from "@remix-run/react";
import { MoreHorizontal } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

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
  getQueueTypeDisplay,
  getStatusColor,
  getStatusText,
} from "../utils/content-helpers";

import { CONTENT_LIST_CARD_HEIGHT_PX } from "./constants";
import { MediaPreviewCollage } from "./MediaPreviewCollage";

function getFetcherFormData(
  fetcher: PostFetcher | undefined
): FormData | null | undefined {
  return (fetcher as { formData?: FormData | null }).formData;
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
  /** Called when the actions menu opens or closes (e.g. so parent can elevate z-index for virtual lists) */
  onMenuOpenChange?: (open: boolean) => void;
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
  onMenuOpenChange,
}: ContentListCardProps) {
  const queueDisplay = getQueueTypeDisplay(item.queueType);
  const mediaUrls = getMediaPreviewUrls(item, 4);
  const hasMedia = mediaUrls.length > 0;

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
      className="border-border bg-card hover:bg-muted/50 flex cursor-pointer items-stretch gap-3 overflow-hidden rounded-lg border p-3 text-left shadow-sm transition-colors"
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
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md">
        {hasMedia ? (
          <MediaPreviewCollage
            urls={mediaUrls}
            className="h-full w-full rounded-md"
            thumbnailClassName="h-full w-full object-cover"
            fallback={
              <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-[10px] font-medium">
                {item.type === "post" ? "TEXT" : "ART"}
              </div>
            }
          />
        ) : (
          <div
            className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium"
            aria-hidden
          >
            {item.type === "post" ? "TEXT" : "ART"}
          </div>
        )}
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <p className="truncate font-medium">{getContentTitle(item)}</p>
        <p className="text-muted-foreground truncate text-xs">
          {getContentPreview(item)?.slice(0, 40) ?? ""}
          {(getContentPreview(item)?.length ?? 0) > 40 ? "…" : ""}
        </p>
        <div className="mt-1 flex flex-shrink-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
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
      <DropdownMenu
        onOpenChange={(open) => {
          onMenuOpenChange?.(open);
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="text-muted-foreground hover:text-foreground focus:ring-ring flex h-8 w-8 items-center justify-center rounded-md focus:ring-2 focus:ring-offset-0 focus:outline-none"
            aria-label="Actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          {type === "posted" ? (
            <>
              {item.type === "post" && item.originalData.signedEvent?.id ? (
                <DropdownMenuItem asChild>
                  <Link
                    to={`https://primal.net/e/${item.originalData.signedEvent.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Note
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {item.type === "longform" &&
              (item.originalData.nostrEventId ||
                item.originalData.signedEvent?.id) ? (
                <DropdownMenuItem asChild>
                  <Link
                    to={`https://primal.net/a/${item.originalData.nostrEventId ?? item.originalData.signedEvent?.id ?? ""}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View Article
                  </Link>
                </DropdownMenuItem>
              ) : null}
              {item.type === "post" && individualRepostFetcher ? (
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
              {onScheduleRepost && item.type === "post" ? (
                <DropdownMenuItem
                  onSelect={() =>
                    onScheduleRepost(item.originalData as PostData)
                  }
                >
                  Schedule repost
                </DropdownMenuItem>
              ) : null}
              {onScheduleQuote && item.type === "post" ? (
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
              {item.type === "post" && onScheduleRepost ? (
                <DropdownMenuItem
                  onSelect={() =>
                    onScheduleRepost(item.originalData as PostData)
                  }
                >
                  Schedule repost
                </DropdownMenuItem>
              ) : null}
              {item.type === "post" && onScheduleQuote ? (
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
          <DropdownMenuSeparator />
          <deleteFetcher.Form method="post">
            <input type="hidden" name="postId" value={item.id} />
            <input
              type="hidden"
              name="_action"
              value={item.type === "post" ? "delete" : "deleteLongForm"}
            />
            <DropdownMenuItem asChild>
              <button
                type="submit"
                disabled={deleteFetcher.state !== "idle"}
                className="text-destructive w-full cursor-pointer disabled:opacity-50"
              >
                {deleteFetcher.state !== "idle" &&
                (deleteFetcher.formData
                  ? (deleteFetcher.formData.get("postId") as string | null) ===
                    item.id
                  : false)
                  ? "Deleting..."
                  : "Delete"}
              </button>
            </DropdownMenuItem>
          </deleteFetcher.Form>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
