import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Quote, Share2 } from "lucide-react";
import { useRef } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  INLINE_ICON_STROKE,
  SMALL_ICON_SIZE_CLASS,
} from "~/lib/icon-constants";
import { getNowForDateTimeLocal } from "~/lib/temporal";

import { getDynamicQueueStyle, getQueueAccentHex } from "../queue-colors";

import { BulkAlsoScheduleCell } from "./BulkAlsoScheduleCell";
import type {
  QuoteScheduleItem,
  RepostScheduleItem,
} from "./BulkAlsoScheduleCell";
import type { BulkPost, QueueType } from "./BulkPostCard";
import { BULK_TABLE_ROW_ESTIMATE_PX } from "./constants";

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
  if (!post.fileUrl) return "";
  if (Array.isArray(post.fileUrl)) {
    return typeof post.fileUrl[0] === "string" ? post.fileUrl[0] : "";
  }
  return typeof post.fileUrl === "string" && post.fileUrl.trim() !== ""
    ? post.fileUrl
    : "";
}

function getRepostImageUrl(post: BulkPost): string {
  if (!post.fileUrl) return "";
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
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >,
  handleMediaClick: (mediaSrc: string) => void,
  onRowFileSelect?: (index: number, file: File) => void,
  onRowFileRemove?: (index: number, fileIndex: number) => void
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

  // Multiple files / URLs for this row
  const previewList = previewData.get(index) ?? [];
  const fileUrlsFromDraft = Array.isArray(post.fileUrl)
    ? post.fileUrl
    : post.fileUrl
      ? [post.fileUrl]
      : [];
  const hasFiles = post.files.length > 0;
  const hasDraftUrls = fileUrlsFromDraft.length > 0;
  const hasAnyMedia = hasFiles || hasDraftUrls;

  if (hasAnyMedia || onRowFileSelect) {
    const filesCount = previewList.length;
    return (
      <div className="flex flex-wrap items-start gap-2">
        {previewList.map((previewInfo, fileIndex) => (
          <div key={`file-${previewInfo.url}`} className="group relative">
            <MediaThumbnail
              src={previewInfo.url}
              alt="Preview"
              className="h-24 w-24 rounded object-cover"
              onClick={() => handleMediaClick(previewInfo.url)}
              forceType={previewInfo.isVideo ? "video" : "image"}
            />
            {onRowFileRemove ? (
              <button
                type="button"
                onClick={() => onRowFileRemove(index, fileIndex)}
                className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full opacity-90 shadow hover:opacity-100"
                aria-label="Remove media"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {fileUrlsFromDraft.map((url, urlIndex) => (
          <div key={`url-${url}`} className="group relative">
            <MediaThumbnail
              src={url}
              alt="Preview"
              className="h-24 w-24 rounded object-cover"
              onClick={() => handleMediaClick(url)}
            />
            {onRowFileRemove ? (
              <button
                type="button"
                onClick={() => onRowFileRemove(index, filesCount + urlIndex)}
                className="bg-destructive text-destructive-foreground absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full opacity-90 shadow hover:opacity-100"
                aria-label="Remove media"
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {onRowFileSelect ? (
          <label className="border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-0.5 rounded border border-dashed text-xs transition-colors">
            <input
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onRowFileSelect(index, file);
                e.target.value = "";
              }}
              aria-label="Add image to this post"
            />
            <span className="font-medium">+ Add</span>
          </label>
        ) : null}
      </div>
    );
  }

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
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >;
  handleCaptionChange: (index: number, value: string) => void;
  handleDateChange: (index: number, value: string) => void;
  handleIsRecyclableChange: (index: number, checked: boolean) => void;
  handleRemovePost: (index: number) => void;
  handleQueueTypeChange: (index: number, value: string) => void;
  handleMediaClick: (mediaSrc: string) => void;
  validationErrorsByIndex?: Record<number, string[]>;
  onRowFileSelect?: (index: number, file: File) => void;
  onRowFileRemove?: (index: number, mediaIndex: number) => void;
  onRepostSchedulesChange?: (index: number, list: RepostScheduleItem[]) => void;
  onQuoteSchedulesChange?: (index: number, list: QuoteScheduleItem[]) => void;
  showAlsoSchedule?: boolean;
  userTimezone?: string;
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
  validationErrorsByIndex,
  onRowFileSelect,
  onRowFileRemove,
  onRepostSchedulesChange,
  onQuoteSchedulesChange,
  showAlsoSchedule,
  userTimezone = "UTC",
}: BulkPostsTableProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  /** Fixed + capped tracks so Caption does not steal all space; Also column ≥ 200px to match cell content. */
  const gridCols = showAlsoSchedule
    ? "minmax(104px,120px) minmax(180px,26rem) minmax(148px,13rem) minmax(168px,13.5rem) minmax(200px,15rem) minmax(96px,7.5rem) minmax(76px,5.75rem)"
    : "minmax(104px,120px) minmax(180px,26rem) minmax(148px,13rem) minmax(168px,13.5rem) minmax(96px,7.5rem) minmax(76px,5.75rem)";

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is not memoization-safe by design
  const rowVirtualizer = useVirtualizer({
    count: posts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => BULK_TABLE_ROW_ESTIMATE_PX,
    overscan: 3,
    getItemKey: (index) => posts[index]?.clientId ?? String(index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  if (posts.length === 0) return null;

  return (
    <TooltipProvider>
      <div
        ref={parentRef}
        className="overflow-auto overflow-x-auto rounded border"
        style={{ maxHeight: "min(70vh, 720px)" }}
      >
        {/* Sticky header with same grid as rows for alignment */}
        <div
          className="bg-muted/50 sticky top-0 z-10 grid w-full min-w-max shrink-0 items-center gap-x-3 gap-y-1 border-b px-4 py-3 text-left text-sm font-medium"
          style={{ gridTemplateColumns: gridCols }}
        >
          <span className="min-w-0">Media</span>
          <span className="min-w-0">Caption</span>
          <span className="min-w-0">Queue</span>
          <span className="min-w-0">Schedule</span>
          {showAlsoSchedule ? (
            <span className="min-w-0 text-xs leading-tight">
              Also repost/quote
            </span>
          ) : null}
          <span className="min-w-0">Recyclable</span>
          <span className="min-w-0">Actions</span>
        </div>
        <div
          className="relative w-full"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {virtualItems.map((virtualRow) => {
            const index = virtualRow.index;
            const post = posts[index];
            if (!post) return null;
            const rowErrors = validationErrorsByIndex?.[index];
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                className={`bg-card absolute top-0 left-0 grid w-full min-w-max items-start gap-x-3 gap-y-2 border-b px-4 py-3 ${rowErrors?.length ? "border-l-4 border-l-amber-500" : ""}`}
                style={{
                  gridTemplateColumns: gridCols,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div className="flex min-w-0 items-start gap-2">
                  {renderMediaCell(
                    post,
                    index,
                    previewData,
                    handleMediaClick,
                    onRowFileSelect,
                    onRowFileRemove
                  )}
                  {rowErrors?.length ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span
                          className="flex shrink-0 text-amber-600 dark:text-amber-400"
                          aria-label="Validation errors"
                        >
                          <AlertTriangle
                            className="h-5 w-5"
                            strokeWidth={INLINE_ICON_STROKE}
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-xs">
                        <ul className="list-inside list-disc text-xs">
                          {rowErrors.map((err) => (
                            <li key={err}>{err}</li>
                          ))}
                        </ul>
                      </TooltipContent>
                    </Tooltip>
                  ) : null}
                </div>
                <div className="min-w-0 space-y-2">
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
                <div className="flex min-w-0 flex-wrap gap-1">
                  {queueTypes.map((queue) => {
                    const queueName =
                      typeof queue === "string" ? queue : queue.name;
                    const colorToken =
                      typeof queue === "object"
                        ? (queue as { colorToken?: string | null }).colorToken
                        : null;
                    const accent =
                      colorToken != null
                        ? getQueueAccentHex(colorToken)
                        : undefined;
                    const isSelected = post.queueType === queueName;
                    return (
                      <button
                        key={queueName}
                        type="button"
                        onClick={() => {
                          handleQueueTypeChange(
                            index,
                            isSelected ? "unassigned" : queueName
                          );
                        }}
                        title={
                          isSelected
                            ? "Click again to leave unassigned"
                            : undefined
                        }
                        className={`rounded-md border-2 px-3 py-1 text-xs ${getDynamicQueueStyle(colorToken ?? null, isSelected)}`}
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
                <div className="min-w-0">
                  <input
                    type="datetime-local"
                    name="scheduledDates"
                    value={post.scheduledFor}
                    onChange={(e) => handleDateChange(index, e.target.value)}
                    min={getNowForDateTimeLocal(userTimezone)}
                    className="dark:bg-card text-foreground dark:text-foreground box-border w-full max-w-full min-w-0 rounded-lg border p-2 text-sm"
                  />
                </div>
                {showAlsoSchedule &&
                onRepostSchedulesChange &&
                onQuoteSchedulesChange ? (
                  <div className="min-w-0 align-top">
                    <BulkAlsoScheduleCell
                      repostSchedules={post.repostSchedules ?? []}
                      quoteSchedules={post.quoteSchedules ?? []}
                      onRepostSchedulesChange={(list) =>
                        onRepostSchedulesChange(index, list)
                      }
                      onQuoteSchedulesChange={(list) =>
                        onQuoteSchedulesChange(index, list)
                      }
                      rowLabelId={post.clientId}
                    />
                  </div>
                ) : null}
                <div className="flex min-w-0 items-center">
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
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => handleRemovePost(index)}
                    className="bg-destructive hover:bg-destructive rounded px-3 py-1 text-sm whitespace-nowrap text-white"
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}
