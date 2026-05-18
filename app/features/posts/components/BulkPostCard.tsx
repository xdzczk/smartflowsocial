/**
 * BulkPostCard Component
 * Individual post card for bulk scheduling view
 * Extracted from dashboard.bulkposts.tsx
 */
import { Quote, Share2 } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { getNowForDateTimeLocal } from "~/lib/temporal";

import { getDynamicQueueStyle, getQueueAccentHex } from "../queue-colors";
import type { BulkPostCardProps, BulkPost, QueueType } from "../types";
// Re-export types for consumers
export type { BulkPost, QueueType };

/**
 * Get the image URL to display for a post
 */
/* eslint-disable-next-line sonarjs/cognitive-complexity -- Multiple post types with different URL shapes */
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

  if (post.isQuotePost && post.fileUrl) {
    if (Array.isArray(post.fileUrl) && post.fileUrl[0]) return post.fileUrl[0];
    if (typeof post.fileUrl === "string" && post.fileUrl.trim() !== "")
      return post.fileUrl;
  }

  if (post.isRepost && post.fileUrl) {
    if (Array.isArray(post.fileUrl) && post.fileUrl[0]) return post.fileUrl[0];
    if (typeof post.fileUrl === "string") return post.fileUrl;
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
  userTimezone = "UTC",
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
              className="h-24 w-24 rounded-xs object-cover"
              onClick={() => onMediaClick(imageUrl)}
            />
            <div className="bg-action-primary absolute -top-1 -right-1 rounded-full p-1">
              <Share2
                className={`${SMALL_ICON_SIZE_CLASS} text-brand-on`}
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
          </div>
        );
      }
      return (
        <div className="bg-surface-hover text-text flex h-24 w-24 items-center justify-center rounded-xs text-xs font-medium">
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
              className="h-24 w-24 rounded-xs object-cover"
              onClick={() => onMediaClick(imageUrl)}
            />
            <div className="bg-success absolute -top-1 -right-1 rounded-full p-1">
              <Quote
                className={`${SMALL_ICON_SIZE_CLASS} text-success-foreground`}
                strokeWidth={INLINE_ICON_STROKE}
                aria-hidden
              />
            </div>
          </div>
        );
      }
      return (
        <div className="bg-success/20 text-success dark:bg-success dark:text-success flex h-24 w-24 items-center justify-center rounded-xs text-xs font-medium">
          QUOTE
        </div>
      );
    }

    // Handle regular reposts with file URL
    const repostUrl =
      post.fileUrl &&
      (Array.isArray(post.fileUrl) ? post.fileUrl[0] : post.fileUrl);
    if (post.isRepost && repostUrl) {
      return (
        <MediaThumbnail
          src={repostUrl}
          alt="Preview"
          className="h-24 w-24 rounded-xs object-cover"
          onClick={() => onMediaClick(repostUrl)}
        />
      );
    }

    // Handle regular file uploads with preview data (supports single or array per row)
    interface PreviewItem {
      url: string;
      isVideo: boolean;
      file: File;
    }
    const previewEntry = previewData.get(index) as
      | PreviewItem
      | PreviewItem[]
      | undefined;
    const previewInfo: PreviewItem | undefined = Array.isArray(previewEntry)
      ? previewEntry[0]
      : previewEntry;
    if (post.files.length > 0 && previewInfo) {
      return (
        <MediaThumbnail
          src={previewInfo.url}
          alt="Preview"
          className="h-24 w-24 rounded-xs object-cover"
          onClick={() => onMediaClick(previewInfo.url)}
          forceType={previewInfo.isVideo ? "video" : "image"}
        />
      );
    }

    // Fallback: TEXT placeholder
    return (
      <div className="dark:bg-surface-hover dark:text-text-secondary bg-surface-hover text-text flex h-24 w-24 items-center justify-center rounded-xs text-xs font-medium">
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
            className={`dark:bg-surface dark:text-text text-text w-full rounded-lg border p-2 ${post.isKind6Repost ? "dark:bg-surface-hover bg-surface-hover cursor-not-allowed" : ""}`}
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
            <div className="dark:bg-surface bg-surface-hover text-text-secondary dark:text-text rounded-xs border p-2 text-xs">
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
            const colorToken =
              typeof queue === "object"
                ? (queue as { colorToken?: string | null }).colorToken
                : null;
            const accent =
              colorToken != null ? getQueueAccentHex(colorToken) : undefined;
            return (
              <button
                key={queueName}
                type="button"
                onClick={() => onQueueTypeChange(index, queueName)}
                className={`rounded-md border-2 px-3 py-1 text-xs ${getDynamicQueueStyle(colorToken ?? null, post.queueType === queueName)}`}
                style={{
                  backgroundColor: accent,
                  borderColor: accent,
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
          min={getNowForDateTimeLocal(userTimezone)}
          className="dark:bg-surface text-text dark:text-text rounded-lg border p-2"
        />
      </td>
      <td className="p-4">
        <div className="flex items-center">
          <Checkbox
            id={`recyclable-${index}`}
            checked={post.isRecyclable}
            onCheckedChange={(c) => onIsRecyclableChange(index, c === true)}
          />
          <label
            htmlFor={`recyclable-${index}`}
            className="text-text-secondary dark:text-text ml-2 text-sm"
          >
            Recyclable
          </label>
        </div>
      </td>
      <td className="p-4">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="bg-danger text-danger-foreground hover:bg-danger rounded-xs px-3 py-1"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

export default BulkPostCard;
