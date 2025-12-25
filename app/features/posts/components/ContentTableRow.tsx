import { Link } from "@remix-run/react";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { CombinedContent, PostData, LongFormPostData, PostFetcher } from "~/features/posts/types";
import {
  getImageUrls,
  getContentTitle,
  getContentPreview,
  formatDate,
  getQueueTypeDisplay,
  getContentTypeBadge,
  getStatusColor,
  getStatusText,
} from "~/features/posts/utils/content-helpers";

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
      className="cursor-pointer even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
      onClick={() => onPostSelect?.(item)}
    >
      {showBulkActions ? (
        <td className="p-3 text-center">
          <input
            type="checkbox"
            checked={selectedItems.has(item.id)}
            onChange={() => onToggleSelection?.(item.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
          />
        </td>
      ) : null}
      <td className="p-3">
        <span className={typeBadge.className}>{typeBadge.text}</span>
      </td>
      <td className="p-3">
        {(() => {
          // For posts, get the first valid image URL
          if (
            item.type === "post" &&
            item.fileUrl &&
            item.fileUrl.length > 0
          ) {
            const imageUrls = getImageUrls(item.fileUrl);
            const firstImageUrl =
              imageUrls.length > 0 ? imageUrls[0] : null;

            if (firstImageUrl) {
              return (
                <MediaThumbnail
                  src={firstImageUrl}
                  alt="Post preview"
                  className="h-12 w-12 rounded object-cover"
                  fallback={
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
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
                  <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                    ART
                  </div>
                }
              />
            );
          }

          // Default fallback based on content type
          return (
            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-100 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">
              {item.type === "post" ? "TEXT" : "ART"}
            </div>
          );
        })()}
      </td>
      <td className="p-3">
        <p className="font-medium">{getContentTitle(item)}</p>
      </td>
      <td className="p-3">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {getContentPreview(item)?.slice(0, 20)}
          {getContentPreview(item)?.length > 20 ? "…" : ""}
        </p>
      </td>
      <td className="p-3">
        {type === "scheduled"
          ? formatDate(item.scheduledFor, true, userTimezone)
          : type === "posted"
            ? formatDate(item.postedAt, false, userTimezone)
            : formatDate(item.createdAt, false, userTimezone)}
      </td>
      <td className="p-3 text-center">
        <div
          className={queueDisplay.className}
          style={queueDisplay.style}
        >
          {queueDisplay.name}
        </div>
      </td>
      <td className="p-3 text-center">
        <div
          className={`inline-flex rounded-full border border-transparent px-2 py-1 text-xs font-semibold leading-4 ${getStatusColor(item)}`}
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
          {item.type === "post" &&
          item.originalData?.signedEvent?.id ? (
            <Link
              to={`https://primal.net/e/${item.originalData.signedEvent.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
            >
              View Note
            </Link>
          ) : null}
          {item.type === "longform" &&
          (item.originalData?.nostrEventId ||
            item.originalData?.signedEvent?.id) ? (
            <Link
              to={`https://primal.net/a/${item.originalData.nostrEventId || item.originalData.signedEvent?.id}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="font-montserrat inline-block rounded-full bg-black/50 px-4 py-1 text-sm text-white transition-colors duration-200 hover:bg-black/70"
            >
              View Article
            </Link>
          ) : null}

          {/* Post Actions - Regular posts */}
          {item.type === "post" && individualRepostFetcher ? (
            <>
              <individualRepostFetcher.Form
                method="post"
                onClick={(e) => e.stopPropagation()}
              >
                <input type="hidden" name="postId" value={item.id} />
                <input type="hidden" name="_action" value="repost" />
                <button
                  type="submit"
                  disabled={
                    individualRepostFetcher.state !== "idle" ||
                    individualRepostFetcher.formData?.get("postId") === item.id
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
                >
                  {individualRepostFetcher.state !== "idle" &&
                  individualRepostFetcher.formData?.get("postId") === item.id
                    ? "Reposting..."
                    : "Repost"}
                </button>
              </individualRepostFetcher.Form>
              <individualRepostFetcher.Form
                method="post"
                onClick={(e) => e.stopPropagation()}
              >
                <input type="hidden" name="postId" value={item.id} />
                <input type="hidden" name="_action" value="quote" />
                <button
                  type="submit"
                  disabled={
                    individualRepostFetcher.state !== "idle" ||
                    individualRepostFetcher.formData?.get("postId") === item.id
                  }
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
                >
                  {individualRepostFetcher.state !== "idle" &&
                  individualRepostFetcher.formData?.get("postId") === item.id
                    ? "Quoting..."
                    : "Quote Post"}
                </button>
              </individualRepostFetcher.Form>
            </>
          ) : null}

          {/* Longform Actions */}
          {item.type === "longform" && longformRepostFetcher ? (
            <longformRepostFetcher.Form
              method="post"
              onClick={(e) => e.stopPropagation()}
            >
              <input type="hidden" name="postId" value={item.id} />
              <input type="hidden" name="_action" value="longformRepost" />
              <button
                type="submit"
                disabled={
                  longformRepostFetcher.state !== "idle" ||
                  longformRepostFetcher.formData?.get("postId") === item.id
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
              >
                {longformRepostFetcher.state !== "idle" &&
                longformRepostFetcher.formData?.get("postId") === item.id
                  ? "Reposting..."
                  : "Repost"}
              </button>
            </longformRepostFetcher.Form>
          ) : null}
          {item.type === "longform" && longformQuoteFetcher ? (
            <longformQuoteFetcher.Form
              method="post"
              onClick={(e) => e.stopPropagation()}
            >
              <input type="hidden" name="postId" value={item.id} />
              <input type="hidden" name="_action" value="longformQuote" />
              <button
                type="submit"
                disabled={
                  longformQuoteFetcher.state !== "idle" ||
                  longformQuoteFetcher.formData?.get("postId") === item.id
                }
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
              >
                {longformQuoteFetcher.state !== "idle" &&
                longformQuoteFetcher.formData?.get("postId") === item.id
                  ? "Quoting..."
                  : "Quote Post"}
              </button>
            </longformQuoteFetcher.Form>
          ) : null}
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
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
          >
            Edit
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReschedulePost?.(item.originalData);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
          >
            Reschedule
          </button>
        </>
      ) : null}

      {/* Delete action - always available */}
      <deleteFetcher.Form
        method="post"
        onClick={(e) => e.stopPropagation()}
      >
        <input type="hidden" name="postId" value={item.id} />
        <input
          type="hidden"
          name="_action"
          value={item.type === "post" ? "delete" : "deleteLongForm"}
        />
        <button
          type="submit"
          disabled={deleteFetcher.state !== "idle"}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
        >
          {deleteFetcher.state !== "idle" &&
          deleteFetcher.formData?.get("postId") === item.id
            ? "Deleting..."
            : "Delete"}
        </button>
      </deleteFetcher.Form>
    </div>
  );
}

