/**
 * BulkPostCard Component
 * Individual post card for bulk scheduling view
 * Extracted from dashboard.bulkposts.tsx
 */
import MediaThumbnail from "~/components/ui/MediaThumbnail";

import { getDynamicQueueStyle } from "../queue-colors";
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
            <div className="bg-primary absolute -top-1 -right-1 rounded-full p-1">
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
        <div className="bg-muted text-foreground flex h-24 w-24 items-center justify-center rounded text-xs font-medium">
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
            <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
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
        <div className="bg-success/20 text-success dark:bg-success dark:text-success flex h-24 w-24 items-center justify-center rounded text-xs font-medium">
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
      <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-24 w-24 items-center justify-center rounded text-xs font-medium">
        TEXT
      </div>
    );
  };

  return (
    <tr className="border-b">
      <td className="p-4">
        {renderMediaPreview()}
        <input type="file" id={`file-input-${index}`} name="files" hidden />
      </td>
      <td className="p-4">
        <div className="space-y-2">
          <textarea
            id={`caption-${index}`}
            name="captions"
            value={post.caption}
            onChange={(e) => onCaptionChange(index, e.target.value)}
            disabled={post.isKind6Repost}
            className={`dark:bg-card dark:text-foreground text-foreground w-full rounded-lg border p-2 ${post.isKind6Repost ? "dark:bg-muted bg-muted cursor-not-allowed" : ""}`}
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
            <div className="dark:bg-card bg-muted text-muted-foreground dark:text-foreground rounded border p-2 text-xs">
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
            const queueName = typeof queue === "string" ? queue : queue.name;
            const queueColor = typeof queue === "object" ? queue.color : null;
            return (
              <button
                key={queueName}
                type="button"
                onClick={() => onQueueTypeChange(index, queueName)}
                className={`rounded-full px-3 py-1 text-xs ${getDynamicQueueStyle(queueColor ?? null, post.queueType === queueName)}`}
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
          className="dark:bg-card text-foreground dark:text-foreground rounded-lg border p-2"
        />
      </td>
      <td className="p-4">
        <div className="flex items-center">
          <input
            id={`recyclable-${index}`}
            type="checkbox"
            checked={post.isRecyclable}
            onChange={(e) => onIsRecyclableChange(index, e.target.checked)}
            className="border-border accent-checkbox focus:ring-checkbox h-4 w-4 rounded"
          />
          <label
            htmlFor={`recyclable-${index}`}
            className="text-muted-foreground dark:text-foreground ml-2 text-sm"
          >
            Recyclable
          </label>
        </div>
      </td>
      <td className="p-4">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="bg-destructive hover:bg-destructive rounded px-3 py-1 text-white"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

export default BulkPostCard;
