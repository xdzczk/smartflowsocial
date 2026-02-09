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
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";

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
  getContentTypeBadge,
  getImageUrls,
  getQueueTypeDisplay,
  getStatusColor,
  getStatusText,
} from "../utils/content-helpers";

// Helper to safely access formData from a fetcher
function getFetcherFormData(
  fetcher: PostFetcher | undefined
): FormData | null | undefined {
  return (fetcher as { formData?: FormData | null }).formData;
}

interface ContentTableRowProps {
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
}

export function ContentTableRow({
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
}: ContentTableRowProps) {
  const typeBadge = getContentTypeBadge(item);
  const queueDisplay = getQueueTypeDisplay(item.queueType);

  return (
    <tr
      key={`${item.type}-${item.id}`}
      className="border-border hover:bg-muted cursor-pointer border-b"
      onClick={() => onPostSelect?.(item)}
    >
      {showBulkActions ? (
        <td className="p-3 text-center">
          <Checkbox
            id={`content-select-${item.id}`}
            checked={selectedItems.has(item.id)}
            onCheckedChange={() => onToggleSelection?.(item.id)}
            onClick={(e) => e.stopPropagation()}
          />
        </td>
      ) : null}
      <td className="p-3">
        <span className={typeBadge.className}>{typeBadge.text}</span>
      </td>
      <td className="p-3">
        {(() => {
          // For posts, get the first valid image URL
          if (item.type === "post" && item.fileUrl && item.fileUrl.length > 0) {
            const imageUrls = getImageUrls(item.fileUrl);
            const firstImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

            if (firstImageUrl) {
              return (
                <MediaThumbnail
                  src={firstImageUrl}
                  alt="Post preview"
                  className="h-12 w-12 rounded object-cover"
                  fallback={
                    <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                      TEXT
                    </div>
                  }
                />
              );
            }
          }

          // For longform posts with images
          if (item.type === "longform" && item.image) {
            return (
              <MediaThumbnail
                src={item.image}
                alt="Article cover"
                className="h-12 w-12 rounded object-cover"
                fallback={
                  <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                    ART
                  </div>
                }
              />
            );
          }

          // Default fallback based on content type
          return (
            <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
              {item.type === "post" ? "TEXT" : "ART"}
            </div>
          );
        })()}
      </td>
      <td className="p-3">
        <p className="font-medium">{getContentTitle(item)}</p>
      </td>
      <td className="p-3">
        <p className="text-muted-foreground text-sm">
          {getContentPreview(item)?.slice(0, 20) ?? ""}
          {(getContentPreview(item)?.length ?? 0) > 20 ? "…" : ""}
        </p>
      </td>
      <td className="text-foreground p-3">
        {type === "scheduled"
          ? formatDate(
              item.scheduledAtUtc ?? undefined,
              false,
              userTimezone,
              userTimeFormat
            )
          : type === "published"
            ? formatDate(
                item.publishedAt ?? undefined,
                false,
                userTimezone,
                userTimeFormat
              )
            : formatDate(item.createdAt, false, userTimezone, userTimeFormat)}
      </td>
      <td className="p-3 text-center">
        <div className={queueDisplay.className} style={queueDisplay.style}>
          {queueDisplay.name}
        </div>
      </td>
      <td className="p-3 text-center">
        <div
          className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs leading-4 font-semibold ${getStatusColor(item)}`}
        >
          {getStatusText(item)}
        </div>
      </td>
      <td className="p-3 text-center">
        <ContentRowActions
          item={item}
          type={type}
          onEditPost={onEditPost}
          onReschedulePost={onReschedulePost}
          deleteFetcher={deleteFetcher}
          individualRepostFetcher={individualRepostFetcher}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          onScheduleRepost={onScheduleRepost}
          onScheduleQuote={onScheduleQuote}
        />
      </td>
    </tr>
  );
}

/* eslint-disable sonarjs/cognitive-complexity -- Row actions menu: many action branches by design */
function ContentRowActions({
  item,
  type,
  onEditPost,
  onReschedulePost,
  deleteFetcher,
  individualRepostFetcher,
  longformRepostFetcher,
  longformQuoteFetcher,
  onScheduleRepost,
  onScheduleQuote,
}: {
  item: CombinedContent;
  type: "scheduled" | "draft" | "published";
  onEditPost?: (post: PostData | LongFormPostData) => void;
  onReschedulePost?: (post: PostData | LongFormPostData) => void;
  deleteFetcher: PostFetcher;
  individualRepostFetcher?: PostFetcher;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="border-border bg-card text-foreground hover:bg-muted focus:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
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

            {item.type === "post" && individualRepostFetcher
              ? (() => {
                  const fetcher = individualRepostFetcher;
                  const formData = getFetcherFormData(fetcher);
                  return (
                    <>
                      <fetcher.Form method="post">
                        <input type="hidden" name="postId" value={item.id} />
                        <input type="hidden" name="_action" value="repost" />
                        <DropdownMenuItem asChild>
                          <button
                            type="submit"
                            disabled={
                              fetcher.state !== "idle" ||
                              (formData
                                ? (formData.get("postId") as string | null) ===
                                  item.id
                                : false)
                            }
                          >
                            {fetcher.state !== "idle" &&
                            (formData
                              ? (formData.get("postId") as string | null) ===
                                item.id
                              : false)
                              ? "Reposting..."
                              : "Repost"}
                          </button>
                        </DropdownMenuItem>
                      </fetcher.Form>
                      <fetcher.Form method="post">
                        <input type="hidden" name="postId" value={item.id} />
                        <input type="hidden" name="_action" value="quote" />
                        <DropdownMenuItem asChild>
                          <button
                            type="submit"
                            disabled={
                              fetcher.state !== "idle" ||
                              (formData
                                ? (formData.get("postId") as string | null) ===
                                  item.id
                                : false)
                            }
                          >
                            {fetcher.state !== "idle" &&
                            (formData
                              ? (formData.get("postId") as string | null) ===
                                item.id
                              : false)
                              ? "Quoting..."
                              : "Quote Post"}
                          </button>
                        </DropdownMenuItem>
                      </fetcher.Form>
                      {onScheduleRepost ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            onScheduleRepost(item.originalData as PostData)
                          }
                        >
                          Schedule repost
                        </DropdownMenuItem>
                      ) : null}
                      {onScheduleQuote ? (
                        <DropdownMenuItem
                          onSelect={() =>
                            onScheduleQuote(item.originalData as PostData)
                          }
                        >
                          Schedule quote
                        </DropdownMenuItem>
                      ) : null}
                    </>
                  );
                })()
              : null}

            {item.type === "longform" && longformRepostFetcher
              ? (() => {
                  const fetcher = longformRepostFetcher;
                  const formData = getFetcherFormData(fetcher);
                  return (
                    <fetcher.Form method="post">
                      <input type="hidden" name="postId" value={item.id} />
                      <input
                        type="hidden"
                        name="_action"
                        value="longformRepost"
                      />
                      <DropdownMenuItem asChild>
                        <button
                          type="submit"
                          disabled={
                            fetcher.state !== "idle" ||
                            (formData
                              ? (formData.get("postId") as string | null) ===
                                item.id
                              : false)
                          }
                        >
                          {fetcher.state !== "idle" &&
                          (formData
                            ? (formData.get("postId") as string | null) ===
                              item.id
                            : false)
                            ? "Reposting..."
                            : "Repost"}
                        </button>
                      </DropdownMenuItem>
                    </fetcher.Form>
                  );
                })()
              : null}
            {item.type === "longform" && longformQuoteFetcher
              ? (() => {
                  const fetcher = longformQuoteFetcher;
                  const formData = getFetcherFormData(fetcher);
                  return (
                    <fetcher.Form method="post">
                      <input type="hidden" name="postId" value={item.id} />
                      <input
                        type="hidden"
                        name="_action"
                        value="longformQuote"
                      />
                      <DropdownMenuItem asChild>
                        <button
                          type="submit"
                          disabled={
                            fetcher.state !== "idle" ||
                            (formData
                              ? (formData.get("postId") as string | null) ===
                                item.id
                              : false)
                          }
                        >
                          {fetcher.state !== "idle" &&
                          (formData
                            ? (formData.get("postId") as string | null) ===
                              item.id
                            : false)
                            ? "Quoting..."
                            : "Quote Post"}
                        </button>
                      </DropdownMenuItem>
                    </fetcher.Form>
                  );
                })()
              : null}
          </>
        ) : null}
        {type === "scheduled" ? (
          <>
            <DropdownMenuItem onSelect={() => onEditPost?.(item.originalData)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => onReschedulePost?.(item.originalData)}
            >
              Reschedule
            </DropdownMenuItem>
            {item.type === "post" && onScheduleRepost ? (
              <DropdownMenuItem
                onSelect={() => onScheduleRepost(item.originalData as PostData)}
              >
                Schedule repost
              </DropdownMenuItem>
            ) : null}
            {item.type === "post" && onScheduleQuote ? (
              <DropdownMenuItem
                onSelect={() => onScheduleQuote(item.originalData as PostData)}
              >
                Schedule quote
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <deleteFetcher.Form method="post">
              <input type="hidden" name="postId" value={item.id} />
              <input type="hidden" name="_action" value="moveToDraft" />
              <input
                type="hidden"
                name="type"
                value={item.type === "post" ? "post" : "longform"}
              />
              <DropdownMenuItem asChild>
                <button type="submit" disabled={deleteFetcher.state !== "idle"}>
                  {deleteFetcher.state !== "idle" &&
                  deleteFetcher.formData?.get("_action") === "moveToDraft" &&
                  (deleteFetcher.formData.get("postId") as string | null) ===
                    item.id
                    ? "Moving..."
                    : "Move to drafts"}
                </button>
              </DropdownMenuItem>
            </deleteFetcher.Form>
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
              className="text-destructive focus:text-destructive"
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
  ); /* eslint-enable sonarjs/cognitive-complexity */
}
