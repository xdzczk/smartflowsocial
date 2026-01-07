/**
 * BulkPostCard Component
 * Individual post card for bulk scheduling view
 * Extracted from dashboard.bulkposts.tsx
 */
import MediaThumbnail from "~/components/ui/MediaThumbnail";

import { getDynamicQueueStyle } from "../queueColors";
import type { BulkPostCardProps, BulkPost, QueueType } from "../types";
// Re-export types for consumers
export type { BulkPost, QueueType };

/**
 * Get the image URL to display for a post
 */
function getDisplayImageUrl(post: BulkPost): string | undefined {
  if (post.isKind6Repost) {
    if (
      post.originalFileUrl &&
      (Array.isArray(post.originalFileUrl)
        ? post.originalFileUrl.length > 0
        : post.originalFileUrl)
    ) {
      let originalImageUrl = Array.isArray(post.originalFileUrl)
        ? post.originalFileUrl[0]
        : post.originalFileUrl;

      // Handle case where fileUrl might be a JSON string array
      if (
        typeof originalImageUrl === "string" &&
        originalImageUrl.startsWith("[")
      ) {
        try {
          const parsed = JSON.parse(originalImageUrl) as string[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            originalImageUrl = parsed[0];
          }
        } catch {
          // If parsing fails, use as is
        }
      }
      return originalImageUrl;
    }
    return undefined;
  }

  if (post.isQuotePost && post.fileUrl && post.fileUrl.trim() !== "") {
    return post.fileUrl;
  }

  if (post.isRepost && post.fileUrl) {
    return post.fileUrl;
  }

  return undefined;
}

export function BulkPostCard({
  post,
  index,
  queueTypes,
  previewData,
  onCaptionChange,
  onDateChange,
  onQueueTypeChange,
  onIsRecyclableChange,
  onRemove,
  onMediaClick,
}: BulkPostCardProps) {
  const renderMediaPreview = () => {
    // Handle kind 6 reposts
    if (post.isKind6Repost) {
      const imageUrl = getDisplayImageUrl(post);
      if (imageUrl) {
        return (
          <div className="relative">
            <MediaThumbnail
              src={imageUrl}
              alt="Original post preview"
              className="h-24 w-24 rounded object-cover"
              onClick={() => onMediaClick(imageUrl)}
            />
            <div className="absolute -right-1 -top-1 rounded-full bg-purple-500 p-1">
              <svg
                className="h-3 w-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
          </div>
        );
      }
      return (
        <div className="flex h-24 w-24 items-center justify-center rounded bg-purple-200 text-xs font-medium text-purple-800 dark:bg-purple-800 dark:text-purple-200">
          REPOST
        </div>
      );
    }

    // Handle quote posts
    if (post.isQuotePost) {
      const imageUrl = getDisplayImageUrl(post);
      if (imageUrl) {
        return (
          <div className="relative">
            <MediaThumbnail
              src={imageUrl}
              alt="Quote post preview"
              className="h-24 w-24 rounded object-cover"
              onClick={() => onMediaClick(imageUrl)}
            />
            <div className="absolute -right-1 -top-1 rounded-full bg-green-500 p-1">
              <svg
                className="h-3 w-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
            </div>
          </div>
        );
      }
      return (
        <div className="flex h-24 w-24 items-center justify-center rounded bg-green-200 text-xs font-medium text-green-800 dark:bg-green-800 dark:text-green-200">
          QUOTE
        </div>
      );
    }

    // Handle regular reposts with file URL
    if (post.isRepost && post.fileUrl) {
      return (
        <MediaThumbnail
          src={post.fileUrl}
          alt="Preview"
          className="h-24 w-24 rounded object-cover"
          onClick={() => onMediaClick(post.fileUrl!)}
        />
      );
    }

    // Handle regular file uploads with preview data
    if (post.file) {
      const previewInfo = previewData.get(index);
      if (previewInfo) {
        return (
          <MediaThumbnail
            src={previewInfo.url}
            alt="Preview"
            className="h-24 w-24 rounded object-cover"
            onClick={() => onMediaClick(previewInfo.url)}
            forceType={previewInfo.isVideo ? "video" : "image"}
          />
        );
      }
    }

    // Fallback: TEXT placeholder
    return (
      <div className="flex h-24 w-24 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
        TEXT
      </div>
    );
  };

  return (
    <tr className="border-b">
      <td className="p-4">
        {renderMediaPreview()}
        <input type="file" name="files" hidden />
      </td>
      <td className="p-4">
        <div className="space-y-2">
          <textarea
            name="captions"
            value={post.caption}
            onChange={(e) => onCaptionChange(index, e.target.value)}
            disabled={post.isKind6Repost}
            className={`w-full rounded-lg border p-2 text-gray-900 dark:bg-gray-800 dark:text-gray-100 ${post.isKind6Repost ? "cursor-not-allowed bg-gray-100 dark:bg-gray-700" : ""}`}
            rows={3}
            placeholder={
              post.isKind6Repost
                ? "Kind 6 reposts have no content..."
                : post.isQuotePost
                  ? "Add your comment to this quote post..."
                  : "Write your caption..."
            }
          />
          {(post.isKind6Repost ?? post.isQuotePost) && post.originalCaption ? (
            <div className="rounded border bg-gray-50 p-2 text-xs text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <strong>Original:</strong>{" "}
              {post.originalCaption.length > 100
                ? post.originalCaption.substring(0, 100) + "..."
                : post.originalCaption}
            </div>
          ) : null}
        </div>
      </td>
      <td className="p-4">
        <div className="flex flex-wrap gap-1">
          {queueTypes.map((queue: QueueType | string) => {
            const queueName =
              typeof queue === "string" ? queue : (queue.name ?? "");
            const queueColor = typeof queue === "object" ? queue.color : null;
            return (
              <button
                key={queueName}
                type="button"
                onClick={() => onQueueTypeChange(index, queueName ?? "")}
                className={`rounded-full px-3 py-1 text-xs ${getDynamicQueueStyle(queueColor ?? null, (post.queueType ?? null) === queueName)}`}
                style={{
                  backgroundColor: queueColor ?? undefined,
                  borderColor: queueColor ?? undefined,
                }}
              >
                {queueName}
              </button>
            );
          })}
        </div>
      </td>
      <td className="p-4">
        <input
          type="datetime-local"
          name="scheduledDates"
          value={post.scheduledFor}
          onChange={(e) => onDateChange(index, e.target.value)}
          className="rounded-lg border p-2 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        />
      </td>
      <td className="p-4">
        <div className="flex items-center">
          <input
            id={`recyclable-${index}`}
            type="checkbox"
            checked={post.isRecyclable ?? false}
            onChange={(e) => onIsRecyclableChange(index, e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <label
            htmlFor={`recyclable-${index}`}
            className="ml-2 text-sm text-gray-700 dark:text-gray-300"
          >
            Recyclable
          </label>
        </div>
      </td>
      <td className="p-4">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

export default BulkPostCard;
