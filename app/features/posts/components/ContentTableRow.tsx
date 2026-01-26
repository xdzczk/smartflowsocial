import { Link } from "@remix-run/react";

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
  type: "scheduled" | "draft" | "posted";
  userTimezone?: string;
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
}

export function ContentTableRow({
  item,
  type,
  userTimezone,
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
          <input
            id={`content-select-${item.id}`}
            name={`content-select-${item.id}`}
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => onToggleSelection?.(item.id)}
            onClick={(e) => e.stopPropagation()}
            className="border-border text-primary focus:ring-primary h-4 w-4 rounded"
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
          ? formatDate(item.scheduledAtUtc ?? undefined, false, userTimezone)
          : type === "posted"
            ? formatDate(item.postedAt, false, userTimezone)
            : formatDate(item.createdAt, false, userTimezone)}
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
}: {
  item: CombinedContent;
  type: "scheduled" | "draft" | "posted";
  onEditPost?: (post: PostData | LongFormPostData) => void;
  onReschedulePost?: (post: PostData | LongFormPostData) => void;
  deleteFetcher: PostFetcher;
  individualRepostFetcher?: PostFetcher;
  longformRepostFetcher?: PostFetcher;
  longformQuoteFetcher?: PostFetcher;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      {type === "posted" ? (
        <>
          {/* View Link - different for posts vs longform */}
          {item.type === "post" && item.originalData.signedEvent?.id ? (
            <Link
              to={`https://primal.net/e/${item.originalData.signedEvent.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-montserrat bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-full px-4 py-1 text-sm transition-colors duration-200"
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
              onClick={(e) => e.stopPropagation()}
              className="font-montserrat bg-primary text-primary-foreground hover:bg-primary/90 inline-block rounded-full px-4 py-1 text-sm transition-colors duration-200"
            >
              View Article
            </Link>
          ) : null}

          {/* Post Actions - Regular posts */}
          {item.type === "post" && individualRepostFetcher
            ? (() => {
                const fetcher = individualRepostFetcher;
                const formData = getFetcherFormData(fetcher);
                return (
                  <>
                    <fetcher.Form
                      method="post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="postId" value={item.id} />
                      <input type="hidden" name="_action" value="repost" />
                      <button
                        type="submit"
                        disabled={
                          fetcher.state !== "idle" ||
                          (formData
                            ? (formData.get("postId") as string | null) ===
                              item.id
                            : false)
                        }
                        className="border-border bg-card text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
                      >
                        {fetcher.state !== "idle" &&
                        (formData
                          ? (formData.get("postId") as string | null) ===
                            item.id
                          : false)
                          ? "Reposting..."
                          : "Repost"}
                      </button>
                    </fetcher.Form>
                    <fetcher.Form
                      method="post"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input type="hidden" name="postId" value={item.id} />
                      <input type="hidden" name="_action" value="quote" />
                      <button
                        type="submit"
                        disabled={
                          fetcher.state !== "idle" ||
                          (formData
                            ? (formData.get("postId") as string | null) ===
                              item.id
                            : false)
                        }
                        className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-success/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
                      >
                        {fetcher.state !== "idle" &&
                        (formData
                          ? (formData.get("postId") as string | null) ===
                            item.id
                          : false)
                          ? "Quoting..."
                          : "Quote Post"}
                      </button>
                    </fetcher.Form>
                  </>
                );
              })()
            : null}

          {/* Longform Actions */}
          {item.type === "longform" && longformRepostFetcher
            ? (() => {
                const fetcher = longformRepostFetcher;
                const formData = getFetcherFormData(fetcher);
                return (
                  <fetcher.Form
                    method="post"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input type="hidden" name="postId" value={item.id} />
                    <input
                      type="hidden"
                      name="_action"
                      value="longformRepost"
                    />
                    <button
                      type="submit"
                      disabled={
                        fetcher.state !== "idle" ||
                        (formData
                          ? (formData.get("postId") as string | null) ===
                            item.id
                          : false)
                      }
                      className="dark:bg-card border-border text-foreground hover:border-border hover:bg-muted focus:ring-ring active:border-border inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
                    >
                      {fetcher.state !== "idle" &&
                      (formData
                        ? (formData.get("postId") as string | null) === item.id
                        : false)
                        ? "Reposting..."
                        : "Repost"}
                    </button>
                  </fetcher.Form>
                );
              })()
            : null}
          {item.type === "longform" && longformQuoteFetcher
            ? (() => {
                const fetcher = longformQuoteFetcher;
                const formData = getFetcherFormData(fetcher);
                return (
                  <fetcher.Form
                    method="post"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input type="hidden" name="postId" value={item.id} />
                    <input type="hidden" name="_action" value="longformQuote" />
                    <button
                      type="submit"
                      disabled={
                        fetcher.state !== "idle" ||
                        (formData
                          ? (formData.get("postId") as string | null) ===
                            item.id
                          : false)
                      }
                      className="dark:bg-card border-success text-success hover:border-success hover:text-success focus:ring-success/25 active:border-success dark:border-success dark:text-success dark:hover:border-success dark:hover:text-success dark:focus:ring-success/40 dark:active:border-success inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
                    >
                      {fetcher.state !== "idle" &&
                      (formData
                        ? (formData.get("postId") as string | null) === item.id
                        : false)
                        ? "Quoting..."
                        : "Quote Post"}
                    </button>
                  </fetcher.Form>
                );
              })()
            : null}
        </>
      ) : null}
      {/* Edit and Reschedule actions - only for scheduled content */}
      {type === "scheduled" ? (
        <>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEditPost?.(item.originalData);
            }}
            className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-primary/25 active:border-primary/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReschedulePost?.(item.originalData);
            }}
            className="bg-card border-success/30 text-success hover:border-success/50 hover:bg-success/10 focus:ring-success/25 active:border-success/30 dark:text-success inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none"
          >
            Reschedule
          </button>
        </>
      ) : null}

      {/* Delete action - always available */}
      <deleteFetcher.Form method="post" onClick={(e) => e.stopPropagation()}>
        <input type="hidden" name="postId" value={item.id} />
        <input
          type="hidden"
          name="_action"
          value={item.type === "post" ? "delete" : "deleteLongForm"}
        />
        <button
          type="submit"
          disabled={deleteFetcher.state !== "idle"}
          className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-destructive/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-2 py-1 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
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
  );
}
