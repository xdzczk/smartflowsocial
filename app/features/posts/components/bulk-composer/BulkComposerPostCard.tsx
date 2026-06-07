import { ArrowDown, ArrowUp, ChevronDown, Copy, Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "~/components/ui/button";
import { useScheduleOverlapWarning } from "~/features/posts/scheduling/hooks/useScheduleOverlapWarning";
import type { PreparedEvent, RepostConditions } from "~/features/posts/types";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { BulkPost, QueueType } from "../BulkPostCard";

import { BulkComposerPostCardBuildBody } from "./bulk-composer-post-card-build";
import { computeBulkComposerReviewDisplay } from "./bulk-composer-post-card-display";
import { BulkComposerPostCardReviewBody } from "./bulk-composer-post-card-review";
import { buildBulkPostStatusLabel } from "./bulk-composer-post-card-utils";

interface BulkComposerPostCardProps {
  index: number;
  post: BulkPost;
  variant: "build" | "review";
  queueTypes: QueueType[];
  previewData: Map<
    number,
    Array<{ url: string; isVideo: boolean; file: File }>
  >;
  preparedEvent?: PreparedEvent;
  validationErrors?: string[];
  userTimezone: string;
  userTimeFormat: "12h" | "24h";
  showAlsoSchedule: boolean;
  rowMediaUploadDisabled?: boolean;
  onCaptionChange: (index: number, value: string) => void;
  onDateChange: (index: number, value: string) => void;
  onQueueTypeChange: (index: number, value: string) => void;
  onIsRecyclableChange: (index: number, checked: boolean) => void;
  onRemove: (index: number) => void;
  onDuplicate?: (index: number) => void;
  /** Reorder row content while keeping each row's queue + schedule (build only). */
  onReorderRow?: (index: number, direction: "up" | "down") => void;
  totalPosts: number;
  onIncludeHashtagsInNoteBodyChange: (index: number, checked: boolean) => void;
  onMediaClick: (src: string) => void;
  onRowFileSelect?: (index: number, file: File | null) => Promise<void>;
  onRowFileRemove?: (index: number, mediaIndex: number) => void;
  onRepostSchedulesChange?: (
    index: number,
    list: Array<{ value: number; unit: "hours" | "minutes" }>
  ) => void;
  onQuoteSchedulesChange?: (
    index: number,
    list: Array<{
      value: number;
      unit: "hours" | "minutes";
      caption?: string;
    }>
  ) => void;
  onEditFromReview?: (index: number) => void;
  bulkRepostConditions?: RepostConditions | null;
  showBatchRepostConditions?: boolean;
}

export function BulkComposerPostCard({
  index,
  post,
  variant,
  queueTypes,
  previewData,
  preparedEvent,
  validationErrors,
  userTimezone,
  userTimeFormat,
  showAlsoSchedule,
  rowMediaUploadDisabled = false,
  onCaptionChange,
  onDateChange,
  onQueueTypeChange,
  onIsRecyclableChange,
  onRemove,
  onDuplicate,
  onReorderRow,
  totalPosts,
  onIncludeHashtagsInNoteBodyChange,
  onMediaClick,
  onRowFileSelect,
  onRowFileRemove,
  onRepostSchedulesChange,
  onQuoteSchedulesChange,
  onEditFromReview,
  bulkRepostConditions = null,
  showBatchRepostConditions = false,
}: BulkComposerPostCardProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const { dateLocale } = useFormattedDate();
  const status = buildBulkPostStatusLabel(post, validationErrors);
  const queueTypeIdFromSelection = queueTypes.find((queue) => {
    if (typeof queue === "string") return false;
    return queue.name === post.queueType;
  });
  const selectedQueueTypeId =
    queueTypeIdFromSelection && typeof queueTypeIdFromSelection === "object"
      ? queueTypeIdFromSelection.id
      : null;
  const { warning: scheduleOverlapWarning } = useScheduleOverlapWarning({
    scheduledFor: post.scheduledFor,
    queueTypeId: selectedQueueTypeId,
    enabled: variant === "build" && post.scheduledFor.trim().length > 0,
  });

  const canMoveUp = index > 0;
  const canMoveDown = index < totalPosts - 1;

  const previewList = previewData.get(index) ?? [];
  const fileUrlsFromDraft = Array.isArray(post.fileUrl)
    ? post.fileUrl
    : post.fileUrl
      ? [post.fileUrl]
      : [];

  const reviewDisplay = useMemo(() => {
    if (!preparedEvent) return null;
    const display = computeBulkComposerReviewDisplay(
      preparedEvent,
      userTimezone,
      userTimeFormat,
      dateLocale
    );
    const localPreviewUrl = previewList[0]?.url ?? fileUrlsFromDraft[0] ?? "";
    if (!display.mediaUrl.trim() && localPreviewUrl) {
      return { ...display, mediaUrl: localPreviewUrl };
    }
    return display;
  }, [
    preparedEvent,
    userTimezone,
    userTimeFormat,
    dateLocale,
    previewList,
    fileUrlsFromDraft,
  ]);

  const queueTrigger = (
    <button
      type="button"
      disabled={variant === "review"}
      className={cn(
        "border-border text-text hover:bg-surface-hover/80 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
        variant === "review" && "pointer-events-none opacity-90"
      )}
    >
      <span className="truncate">
        {post.queueType && post.queueType !== "unassigned"
          ? post.queueType
          : "Unassigned"}
      </span>
      {variant === "build" ? (
        <ChevronDown className="size-3 shrink-0 opacity-60" aria-hidden />
      ) : null}
    </button>
  );

  return (
    <article
      data-bulk-post-index={index}
      className={cn(
        "border-border bg-surface shadow-1 rounded-xl border",
        validationErrors?.length && variant === "build"
          ? "ring-warning/30 ring-1"
          : ""
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text text-sm font-semibold">
            Post {index + 1}
          </span>
          <span
            className={cn(
              "rounded-md border px-1.5 py-0.5 text-xs font-medium",
              status.variant === "amber" &&
                "border-warning/40 bg-warning/10 text-warning-text",
              status.variant === "muted" &&
                "border-border bg-surface-hover/40 text-text-secondary",
              status.variant === "default" &&
                "border-selection-border/30 bg-selection-wash text-selection-foreground"
            )}
          >
            {variant === "review" && reviewDisplay ? "Locked" : status.label}
          </span>
          {variant === "build" && scheduleOverlapWarning ? (
            <span className="border-warning/40 bg-warning/10 text-warning-text rounded-md border px-1.5 py-0.5 text-xs font-medium">
              Timing warning
            </span>
          ) : null}
        </div>
        <div className="cluster-tight">
          {variant === "build" ? (
            <>
              {onReorderRow && totalPosts > 1 ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-text-secondary h-8 px-2"
                    disabled={!canMoveUp}
                    onClick={() => onReorderRow(index, "up")}
                    aria-label="Move content up one slot"
                    title="Move content up (queue times stay on fixed slots)"
                  >
                    <ArrowUp
                      className="size-4"
                      strokeWidth={INLINE_ICON_STROKE}
                    />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-text-secondary h-8 px-2"
                    disabled={!canMoveDown}
                    onClick={() => onReorderRow(index, "down")}
                    aria-label="Move content down one slot"
                    title="Move content down (queue times stay on fixed slots)"
                  >
                    <ArrowDown
                      className="size-4"
                      strokeWidth={INLINE_ICON_STROKE}
                    />
                  </Button>
                </>
              ) : null}
              {onDuplicate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-text-secondary h-8 px-2"
                  onClick={() => onDuplicate(index)}
                  aria-label="Duplicate post"
                >
                  <Copy className="size-4" strokeWidth={INLINE_ICON_STROKE} />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-text-secondary h-8 px-2"
                onClick={() => setAdvancedOpen((o) => !o)}
                aria-expanded={advancedOpen}
                title="Queue, schedule, follow-up, recyclable, and tags"
              >
                Advanced
                <ChevronDown
                  className={cn(
                    "ml-1 size-4 transition-transform",
                    advancedOpen && "rotate-180"
                  )}
                />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-danger hover:text-danger h-8 px-2"
                onClick={() => onRemove(index)}
              >
                Remove
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => onEditFromReview?.(index)}
            >
              <Pencil
                className="mr-1 size-3.5"
                strokeWidth={INLINE_ICON_STROKE}
              />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 p-3">
        {variant === "review" && reviewDisplay && preparedEvent ? (
          <BulkComposerPostCardReviewBody
            reviewDisplay={reviewDisplay}
            preparedEvent={preparedEvent}
            post={post}
            onMediaClick={onMediaClick}
            bulkRepostConditions={bulkRepostConditions}
            showBatchRepostConditions={showBatchRepostConditions}
          />
        ) : null}
        {variant === "build" ? (
          <BulkComposerPostCardBuildBody
            index={index}
            post={post}
            queueTypes={queueTypes}
            previewList={previewList}
            fileUrlsFromDraft={fileUrlsFromDraft}
            userTimezone={userTimezone}
            rowMediaUploadDisabled={rowMediaUploadDisabled}
            advancedOpen={advancedOpen}
            queueTrigger={queueTrigger}
            showAlsoSchedule={showAlsoSchedule}
            bulkRepostConditions={bulkRepostConditions}
            showBatchRepostConditions={showBatchRepostConditions}
            onCaptionChange={onCaptionChange}
            onDateChange={onDateChange}
            onQueueTypeChange={onQueueTypeChange}
            onIsRecyclableChange={onIsRecyclableChange}
            onIncludeHashtagsInNoteBodyChange={
              onIncludeHashtagsInNoteBodyChange
            }
            onMediaClick={onMediaClick}
            onRowFileSelect={onRowFileSelect}
            onRowFileRemove={onRowFileRemove}
            onRepostSchedulesChange={onRepostSchedulesChange}
            onQuoteSchedulesChange={onQuoteSchedulesChange}
            scheduleOverlapWarning={scheduleOverlapWarning}
          />
        ) : null}

        {validationErrors?.length ? (
          <ul
            className="text-danger space-y-0.5 text-xs leading-snug"
            role="alert"
          >
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
