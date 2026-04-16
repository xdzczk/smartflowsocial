import { Link, useRouteLoaderData } from "@remix-run/react";
import type { FetcherWithComponents } from "@remix-run/react";
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
import {
  ContentStatusChip,
  PUBLISHING_DATETIME_CELL_CLASS,
  PUBLISHING_TABLE_ROW_CLASS,
  QueueStatusChip,
} from "~/features/posts/components/publishing-suite";
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
import { cn } from "~/lib/utils";

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
  getPostRowThumbnailBadge,
  isPureRepostSourceContent,
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
  onResumeDraft?: () => void;
  draftsActionFetcher?: FetcherWithComponents<{
    success?: boolean;
    newPostId?: string;
    error?: string;
  }>;
  onEditPost?: (post: PostData | LongFormPostData) => void;
  onReschedulePost?: (post: PostData | LongFormPostData) => void;
  deleteFetcher: PostFetcher;
  individualRepostFetcher?: PostFetcher;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  onBeforeDelete?: (postId: string) => void;
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
  onResumeDraft,
  draftsActionFetcher,
  onEditPost,
  onReschedulePost,
  deleteFetcher,
  individualRepostFetcher,
  longformRepostFetcher,
  longformQuoteFetcher,
  onScheduleRepost,
  onScheduleQuote,
  onBeforeDelete,
}: ContentTableRowProps) {
  const { dateLocale } = useFormattedDate();
  const typeBadge = getContentTypeBadge(item);
  const isRepost = isRepostContent(item);
  const titleText = getContentTitle(item);
  const previewRaw = getContentPreview(item)?.trim() ?? "";
  const excerpt =
    previewRaw.length > 0 && previewRaw !== titleText.trim()
      ? previewRaw
      : null;
  const postThumbnailBadge =
    item.type === "longform"
      ? ("ART" as const)
      : getPostRowThumbnailBadge({
          contentKind: "post",
          postType: item.postType,
          signedEvent: item.signedEvent ?? null,
          repost: isRepost,
          postKind: item.postKind ?? null,
        });

  const isSelected = selectedItems.has(item.id);

  return (
    <tr
      key={`${item.type}-${item.id}`}
      className={cn(
        PUBLISHING_TABLE_ROW_CLASS,
        isSelected && "bg-muted/40 hover:bg-muted/50"
      )}
      onClick={() => {
        if (type === "draft" && onResumeDraft) {
          onResumeDraft();
          return;
        }
        onPostSelect?.(item);
      }}
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
                        {postThumbnailBadge}
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
                {postThumbnailBadge}
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
      <td className="max-w-md p-3 whitespace-normal">
        <p className="text-foreground leading-snug font-semibold">
          {titleText}
        </p>
        {excerpt ? (
          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
            {excerpt}
          </p>
        ) : null}
        {type === "scheduled" && item.dependencyMode === "attached" ? (
          <p className="text-muted-foreground mt-1 text-xs">
            Follow-up
            {item.followUpTimingMode === "offset_from_parent"
              ? " · Offset from parent"
              : " · Fixed date/time"}
          </p>
        ) : null}
      </td>
      <td
        className={cn(
          "p-3",
          (type === "scheduled" || type === "published") &&
            PUBLISHING_DATETIME_CELL_CLASS
        )}
      >
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
                item.updatedAt,
                false,
                userTimezone,
                userTimeFormat,
                dateLocale
              )}
      </td>
      <td className="p-3 text-center">
        <div className="flex justify-center">
          <QueueStatusChip
            queueType={item.queueType}
            mode={type === "draft" ? "draft" : "default"}
          />
        </div>
      </td>
      {type === "draft" ? null : (
        <td className="p-3 text-center">
          <div className="flex justify-center">
            <ContentStatusChip item={item} />
          </div>
        </td>
      )}
      <td className="p-3 text-center">
        <ContentRowActions
          item={item}
          type={type}
          draftsActionFetcher={draftsActionFetcher}
          onEditPost={onEditPost}
          onReschedulePost={onReschedulePost}
          deleteFetcher={deleteFetcher}
          individualRepostFetcher={individualRepostFetcher}
          longformRepostFetcher={longformRepostFetcher}
          longformQuoteFetcher={longformQuoteFetcher}
          onScheduleRepost={onScheduleRepost}
          onScheduleQuote={onScheduleQuote}
          onBeforeDelete={onBeforeDelete}
        />
      </td>
    </tr>
  );
}

/* eslint-disable-next-line sonarjs/cognitive-complexity -- Row actions menu composes many conditional fetcher targets */
export function ContentRowActions({
  item,
  type,
  draftsActionFetcher,
  onEditPost,
  onReschedulePost,
  deleteFetcher,
  individualRepostFetcher,
  longformRepostFetcher,
  longformQuoteFetcher,
  onScheduleRepost,
  onScheduleQuote,
  onBeforeDelete,
}: {
  item: CombinedContent;
  type: "scheduled" | "draft" | "published";
  draftsActionFetcher?: FetcherWithComponents<{
    success?: boolean;
    newPostId?: string;
    error?: string;
  }>;
  onEditPost?: (post: PostData | LongFormPostData) => void;
  onReschedulePost?: (post: PostData | LongFormPostData) => void;
  deleteFetcher: PostFetcher;
  individualRepostFetcher?: PostFetcher;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
  onScheduleRepost?: (post: PostData) => void;
  onScheduleQuote?: (post: PostData) => void;
  onBeforeDelete?: (postId: string) => void;
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
  const blockRepostQuoteChain = isPureRepostSourceContent(item);
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
            !blockRepostQuoteChain
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
            {item.type === "post" &&
            onScheduleRepost &&
            !blockRepostQuoteChain ? (
              <DropdownMenuItem
                onSelect={() => onScheduleRepost(item.originalData as PostData)}
              >
                Schedule repost
              </DropdownMenuItem>
            ) : null}
            {item.type === "post" &&
            onScheduleQuote &&
            !blockRepostQuoteChain ? (
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
                onBeforeDelete?.(item.id);
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
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            onBeforeDelete?.(item.id);
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
            : type === "draft"
              ? "Delete draft"
              : "Delete"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
