import { Quote, Share2 } from "lucide-react";

import { Checkbox } from "~/components/ui/checkbox";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";

import { getDynamicQueueStyle } from "../queue-colors";

import type { BulkPost, QueueType } from "./BulkPostCard";

// ============================================================================
// Helper Functions and Components
// ============================================================================

function getKind6RepostImageUrl(post: BulkPost): string {
  if (!post.originalFileUrl || post.originalFileUrl.length === 0) {
    return "";
  }

  let originalImageUrl = "";
  if (Array.isArray(post.originalFileUrl)) {
    originalImageUrl = post.originalFileUrl[0] ?? "";
  } else {
    originalImageUrl = post.originalFileUrl ?? "";
  }

  // Handle case where fileUrl might be a JSON string array
  if (
    typeof originalImageUrl === "string" &&
    originalImageUrl.startsWith("[")
  ) {
    try {
      const parsed = JSON.parse(originalImageUrl) as string[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        originalImageUrl = parsed[0] ?? "";
      }
    } catch {
      // If parsing fails, use as is
    }
  }

  return originalImageUrl;
}

function getQuotePostImageUrl(post: BulkPost): string {
  if (!post.fileUrl || post.fileUrl.trim() === "") {
    return "";
  }

  if (Array.isArray(post.fileUrl)) {
    return typeof post.fileUrl[0] === "string" ? post.fileUrl[0] : "";
  }

  return typeof post.fileUrl === "string" ? post.fileUrl : "";
}

function getRepostImageUrl(post: BulkPost): string {
  if (!post.fileUrl) {
    return "";
  }

  if (Array.isArray(post.fileUrl)) {
    return typeof post.fileUrl[0] === "string" ? post.fileUrl[0] : "";
  }

  return typeof post.fileUrl === "string" ? post.fileUrl : "";
}

interface MediaWithBadgeProps {
  src: string;
  alt: string;
  badgeColor: string;
  badgeIcon: React.ReactNode;
  onClick: () => void;
}

function MediaWithBadge({
  src,
  alt,
  badgeColor,
  badgeIcon,
  onClick,
}: MediaWithBadgeProps) {
  return (
    <div className="relative">
      <MediaThumbnail
        src={src}
        alt={alt}
        className="h-24 w-24 rounded object-cover"
        onClick={onClick}
      />
      <div
        className={`absolute -top-1 -right-1 rounded-full ${badgeColor} p-1`}
      >
        {badgeIcon}
      </div>
    </div>
  );
}

function PlaceholderBadge({
  text,
  bgColor,
  textColor,
}: {
  text: string;
  bgColor: string;
  textColor: string;
}) {
  return (
    <div
      className={`flex h-24 w-24 items-center justify-center rounded text-xs font-medium ${bgColor} ${textColor}`}
    >
      {text}
    </div>
  );
}

function renderMediaCell(
  post: BulkPost,
  index: number,
  previewData: Map<number, { url: string; isVideo: boolean; file: File }>,
  handleMediaClick: (mediaSrc: string) => void
): React.ReactNode {
  // Kind 6 reposts
  if (post.isKind6Repost) {
    const originalImageUrl = getKind6RepostImageUrl(post);
    if (originalImageUrl) {
      return (
        <MediaWithBadge
          src={originalImageUrl}
          alt="Original post preview"
          badgeColor="bg-primary"
          badgeIcon={
            <Share2
              className={`${SMALL_ICON_SIZE_CLASS} text-white`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          }
          onClick={() => handleMediaClick(originalImageUrl)}
        />
      );
    }
    return (
      <PlaceholderBadge
        text="REPOST"
        bgColor="bg-muted"
        textColor="text-foreground"
      />
    );
  }

  // Quote posts
  if (post.isQuotePost) {
    const fileUrl = getQuotePostImageUrl(post);
    if (fileUrl) {
      return (
        <MediaWithBadge
          src={fileUrl}
          alt="Quote post preview"
          badgeColor="bg-success"
          badgeIcon={
            <Quote
              className={`${SMALL_ICON_SIZE_CLASS} text-white`}
              strokeWidth={INLINE_ICON_STROKE}
              aria-hidden
            />
          }
          onClick={() => handleMediaClick(fileUrl)}
        />
      );
    }
    return (
      <PlaceholderBadge
        text="QUOTE"
        bgColor="bg-success/20 dark:bg-success"
        textColor="text-success dark:text-success"
      />
    );
  }

  // Regular reposts
  if (post.isRepost && post.fileUrl) {
    const imageUrl = getRepostImageUrl(post);
    if (imageUrl && imageUrl.trim() !== "") {
      return (
        <MediaThumbnail
          src={imageUrl}
          alt="Preview"
          className="h-24 w-24 rounded object-cover"
          onClick={() => handleMediaClick(imageUrl)}
        />
      );
    }
  }

  // Regular file uploads
  if (post.file) {
    const previewInfo = previewData.get(index);
    if (previewInfo) {
      return (
        <MediaThumbnail
          src={previewInfo.url}
          alt="Preview"
          className="h-24 w-24 rounded object-cover"
          onClick={() => handleMediaClick(previewInfo.url)}
          forceType={previewInfo.isVideo ? "video" : "image"}
        />
      );
    }
  }

  // Fallback: text-only post
  return (
    <PlaceholderBadge
      text="TEXT"
      bgColor="bg-muted dark:bg-muted"
      textColor="text-foreground dark:text-foreground"
    />
  );
}

interface BulkPostsTableProps {
  posts: BulkPost[];
  queueTypes: QueueType[];
  previewData: Map<number, { url: string; isVideo: boolean; file: File }>;
  handleCaptionChange: (index: number, value: string) => void;
  handleDateChange: (index: number, value: string) => void;
  handleIsRecyclableChange: (index: number, checked: boolean) => void;
  handleRemovePost: (index: number) => void;
  handleQueueTypeChange: (index: number, value: string) => void;
  handleMediaClick: (mediaSrc: string) => void;
}

export default function BulkPostsTable({
  posts,
  queueTypes,
  previewData,
  handleCaptionChange,
  handleDateChange,
  handleIsRecyclableChange,
  handleRemovePost,
  handleQueueTypeChange,
  handleMediaClick,
}: BulkPostsTableProps) {
  if (posts.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="p-4 text-left">Media</th>
            <th className="p-4 text-left">Caption</th>
            <th className="p-4 text-left">Queue</th>
            <th className="p-4 text-left">Schedule</th>
            <th className="p-4 text-left">Recyclable</th>
            <th className="p-4 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post, index) => (
            <tr key={post.clientId} className="border-b">
              <td className="p-4">
                {renderMediaCell(post, index, previewData, handleMediaClick)}
                <input
                  type="file"
                  id={`file-input-${index}`}
                  name="files"
                  hidden
                />
              </td>
              <td className="p-4">
                <div className="space-y-2">
                  <textarea
                    id={`caption-${index}`}
                    name="captions"
                    value={post.caption}
                    onChange={(e) => handleCaptionChange(index, e.target.value)}
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
                  {(post.isKind6Repost || post.isQuotePost) &&
                  post.originalCaption ? (
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
                  {queueTypes.map((queue) => {
                    const queueName =
                      typeof queue === "string" ? queue : queue.name;
                    const queueColor =
                      typeof queue === "object" ? queue.color : null;
                    return (
                      <button
                        key={queueName}
                        type="button"
                        onClick={() => {
                          handleQueueTypeChange(index, queueName);
                        }}
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
                  onChange={(e) => handleDateChange(index, e.target.value)}
                  className="dark:bg-card text-foreground dark:text-foreground rounded-lg border p-2"
                />
              </td>
              <td className="p-4">
                <div className="flex items-center">
                  <Checkbox
                    id={`bulk-recyclable-${post.clientId}`}
                    checked={post.isRecyclable}
                    onCheckedChange={(c) =>
                      handleIsRecyclableChange(index, c === true)
                    }
                  />
                  <label
                    htmlFor={`bulk-recyclable-${post.clientId}`}
                    className="text-muted-foreground dark:text-foreground ml-2 text-sm"
                  >
                    Recyclable
                  </label>
                </div>
              </td>
              <td className="p-4">
                <button
                  type="button"
                  onClick={() => handleRemovePost(index)}
                  className="bg-destructive hover:bg-destructive rounded px-3 py-1 text-white"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
