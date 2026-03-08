import { Link, useRouteLoaderData } from "@remix-run/react";
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
import MediaThumbnail from "~/components/ui/MediaThumbnail";
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
  getContentTypeBadge,
  getImageUrls,
  getQueueTypeDisplay,
  getStatusColor,
  getStatusText,
  isRepostContent,
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
  const { dateLocale } = useFormattedDate();
  const typeBadge = getContentTypeBadge(item);
  const queueDisplay = getQueueTypeDisplay(item.queueType);

  return (
    <tr
      key={`${item.type}-${item.id}`}
      className="group border-border hover:bg-muted cursor-pointer border-b"
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
          const isRepost = isRepostContent(item);
          // For posts, get the first valid image URL (includes reposts with merged original media)
          if (item.type === "post" && item.fileUrl && item.fileUrl.length > 0) {
            const imageUrls = getImageUrls(item.fileUrl);
            const firstImageUrl = imageUrls.length > 0 ? imageUrls[0] : null;

            if (firstImageUrl) {
              return (
                <div className="relative inline-block">
                  <MediaThumbnail
                    src={firstImageUrl}
                    alt="Post preview"
                    className="h-12 w-12 rounded object-cover"
                    fallback={
                      <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                        {isRepost ? "REPOST" : "TEXT"}
                      </div>
                    }
                  />
                  {isRepost ? (
                    <div className="bg-primary absolute -top-1 -right-1 rounded-full p-0.5">
                      <Repeat
                        className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                  ) : null}
                </div>
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

          // Default fallback: repost with no media vs text post vs article
          return (
            <div className="relative inline-block">
              <div className="bg-muted text-muted-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                {item.type === "post" ? (isRepost ? "REPOST" : "TEXT") : "ART"}
              </div>
              {isRepost ? (
                <div className="bg-primary absolute -top-1 -right-1 rounded-full p-0.5">
                  <Repeat
                    className={`${SMALL_ICON_SIZE_CLASS} text-white`}
                    strokeWidth={2}
                    aria-hidden
                  />
                </div>
              ) : null}
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
            : formatDate(
                item.createdAt,
                false,
                userTimezone,
                userTimeFormat,
                dateLocale
              )}
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
                  to={nostrUrls.eventUrl(item.originalData.signedEvent.id)}
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
            <DropdownMenuItem
              disabled={deleteFetcher.state !== "idle"}
              onSelect={() => {
                const formData = new FormData();
                formData.set("postId", item.id);
                formData.set("_action", "moveToDraft");
                formData.set(
                  "type",
                  item.type === "post" ? "post" : "longform"
                );
                deleteFetcher.submit(formData, { method: "post" });
              }}
            >
              {deleteFetcher.state !== "idle" &&
              deleteFetcher.formData?.get("_action") === "moveToDraft" &&
              (deleteFetcher.formData.get("postId") as string | null) ===
                item.id
                ? "Moving..."
                : "Move to drafts"}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={deleteFetcher.state !== "idle"}
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            const formData = new FormData();
            formData.set("postId", item.id);
            formData.set(
              "_action",
              item.type === "post" ? "delete" : "deleteLongForm"
            );
            deleteFetcher.submit(formData, { method: "post" });
          }}
        >
          {deleteFetcher.state !== "idle" &&
          (deleteFetcher.formData
            ? (deleteFetcher.formData.get("postId") as string | null) ===
              item.id
            : false)
            ? "Deleting..."
            : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
