import { ActionRailLabel } from "~/components/action-rail";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Textarea } from "~/components/ui/textarea";
import {
  RailSettingsRow,
  railFieldClassNames,
} from "~/features/posts/components/publishing-rail";
import {
  getDynamicQueueStyle,
  getQueueAccentHex,
} from "~/features/posts/queue-colors";
import type { RepostConditions } from "~/features/posts/types";
import { getNowForDateTimeLocal } from "~/lib/temporal";
import { cn } from "~/lib/utils";

import { BulkAlsoScheduleCell } from "../BulkAlsoScheduleCell";
import type { BulkPost, QueueType } from "../BulkPostCard";

import { followUpSummaryLine } from "./bulk-composer-post-card-utils";

const REMOVE_MEDIA_BTN_CLASS =
  "bg-danger text-danger-foreground absolute -top-1 -right-1 flex size-6 items-center justify-center rounded-full text-xs";

function BulkComposerPostAdvancedBlock({
  index,
  post,
  queueTypes,
  userTimezone,
  queueTrigger,
  showAlsoSchedule,
  bulkRepostConditions,
  showBatchRepostConditions,
  onQueueTypeChange,
  onDateChange,
  onIsRecyclableChange,
  onIncludeHashtagsInNoteBodyChange,
  onRepostSchedulesChange,
  onQuoteSchedulesChange,
  scheduleOverlapWarning,
}: {
  index: number;
  post: BulkPost;
  queueTypes: QueueType[];
  userTimezone: string;
  queueTrigger: React.ReactNode;
  showAlsoSchedule: boolean;
  bulkRepostConditions: RepostConditions | null;
  showBatchRepostConditions: boolean;
  onQueueTypeChange: (index: number, value: string) => void;
  onDateChange: (index: number, value: string) => void;
  onIsRecyclableChange: (index: number, checked: boolean) => void;
  onIncludeHashtagsInNoteBodyChange: (index: number, checked: boolean) => void;
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
  scheduleOverlapWarning: string | null;
}) {
  const scheduleInputId = `bulk-sched-${post.clientId}`;
  const queuePopover = (
    <Popover>
      <PopoverTrigger asChild>{queueTrigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="max-h-56 space-y-1 overflow-y-auto">
          <button
            type="button"
            className="hover:bg-surface-hover w-full rounded-xs px-2 py-1.5 text-left text-sm"
            onClick={() => onQueueTypeChange(index, "unassigned")}
          >
            Unassigned
          </button>
          {queueTypes.map((queue) => {
            const name = typeof queue === "string" ? queue : queue.name;
            const colorToken =
              typeof queue === "object"
                ? (queue as { colorToken?: string | null }).colorToken
                : null;
            const accent =
              colorToken != null ? getQueueAccentHex(colorToken) : undefined;
            return (
              <button
                key={name}
                type="button"
                className={`w-full rounded-xs px-2 py-1.5 text-left text-sm ${getDynamicQueueStyle(colorToken ?? null, post.queueType === name)}`}
                style={{
                  backgroundColor: post.queueType === name ? accent : undefined,
                }}
                onClick={() => onQueueTypeChange(index, name)}
              >
                {name}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );

  return (
    <div className="border-border space-y-3 border-t pt-2">
      <div className="space-y-2">
        <ActionRailLabel className="normal-case">
          Queue & schedule
        </ActionRailLabel>
        <div className="space-y-2">
          <RailSettingsRow label="Queue" control={queuePopover} />
          <RailSettingsRow
            labelFor={scheduleInputId}
            label="Schedule"
            control={
              <div className="w-full max-w-[14rem] space-y-1">
                <Input
                  id={scheduleInputId}
                  type="datetime-local"
                  name="scheduledDates"
                  value={post.scheduledFor}
                  onChange={(e) => onDateChange(index, e.target.value)}
                  min={getNowForDateTimeLocal(userTimezone)}
                  className={cn(
                    railFieldClassNames,
                    "h-9 w-full max-w-[12rem]"
                  )}
                />
                {scheduleOverlapWarning ? (
                  <p className="text-warning dark:text-warning text-[11px] leading-snug">
                    {scheduleOverlapWarning}
                  </p>
                ) : null}
              </div>
            }
          />
        </div>
      </div>

      <div className="border-border space-y-1.5 border-t pt-2">
        <ActionRailLabel className="normal-case">Follow-up</ActionRailLabel>
        <p className="text-text text-xs leading-snug font-medium">
          {followUpSummaryLine(
            post,
            bulkRepostConditions,
            showBatchRepostConditions
          )}
        </p>
      </div>

      <div className="border-border space-y-2 border-t pt-2">
        <ActionRailLabel className="normal-case">Options</ActionRailLabel>
        <RailSettingsRow
          labelFor={`bulk-rec-card-${post.clientId}`}
          label="Recyclable"
          control={
            <Checkbox
              id={`bulk-rec-card-${post.clientId}`}
              checked={post.isRecyclable}
              onCheckedChange={(c) => onIsRecyclableChange(index, c === true)}
            />
          }
        />
        <RailSettingsRow
          labelFor={`bulk-tags-note-${post.clientId}`}
          label="Hide tags"
          control={
            <Checkbox
              id={`bulk-tags-note-${post.clientId}`}
              checked={post.includeHashtagsInNoteBody === false}
              onCheckedChange={(c) =>
                onIncludeHashtagsInNoteBodyChange(index, c !== true)
              }
            />
          }
        />
      </div>

      {showAlsoSchedule && onRepostSchedulesChange && onQuoteSchedulesChange ? (
        <div className="border-border space-y-2 border-t pt-2">
          <ActionRailLabel className="normal-case">
            Also schedule
          </ActionRailLabel>
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
    </div>
  );
}

export function BulkComposerPostCardBuildBody({
  index,
  post,
  queueTypes,
  previewList,
  fileUrlsFromDraft,
  userTimezone,
  rowMediaUploadDisabled,
  advancedOpen,
  queueTrigger,
  showAlsoSchedule,
  bulkRepostConditions,
  showBatchRepostConditions,
  onCaptionChange,
  onDateChange,
  onQueueTypeChange,
  onIsRecyclableChange,
  onIncludeHashtagsInNoteBodyChange,
  onMediaClick,
  onRowFileSelect,
  onRowFileRemove,
  onRepostSchedulesChange,
  onQuoteSchedulesChange,
  scheduleOverlapWarning,
}: {
  index: number;
  post: BulkPost;
  queueTypes: QueueType[];
  previewList: Array<{ url: string; isVideo: boolean; file: File }>;
  fileUrlsFromDraft: string[];
  userTimezone: string;
  rowMediaUploadDisabled: boolean;
  advancedOpen: boolean;
  queueTrigger: React.ReactNode;
  showAlsoSchedule: boolean;
  bulkRepostConditions: RepostConditions | null;
  showBatchRepostConditions: boolean;
  onCaptionChange: (index: number, value: string) => void;
  onDateChange: (index: number, value: string) => void;
  onQueueTypeChange: (index: number, value: string) => void;
  onIsRecyclableChange: (index: number, checked: boolean) => void;
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
  scheduleOverlapWarning: string | null;
}) {
  return (
    <>
      <div className="stack-tight sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          {previewList.map((previewInfo, fileIndex) => (
            <div key={previewInfo.url} className="group relative">
              <MediaThumbnail
                src={previewInfo.url}
                alt=""
                className="h-24 w-24 rounded-lg object-cover"
                onClick={() => onMediaClick(previewInfo.url)}
                forceType={previewInfo.isVideo ? "video" : "image"}
              />
              {onRowFileRemove ? (
                <button
                  type="button"
                  onClick={() => onRowFileRemove(index, fileIndex)}
                  className={REMOVE_MEDIA_BTN_CLASS}
                  aria-label="Remove media"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {fileUrlsFromDraft.map((url, urlIndex) => (
            <div key={url} className="group relative">
              <MediaThumbnail
                src={url}
                alt=""
                className="h-24 w-24 rounded-lg object-cover"
                onClick={() => onMediaClick(url)}
              />
              {onRowFileRemove ? (
                <button
                  type="button"
                  onClick={() =>
                    onRowFileRemove(index, previewList.length + urlIndex)
                  }
                  className={REMOVE_MEDIA_BTN_CLASS}
                  aria-label="Remove media"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          {onRowFileSelect ? (
            <label
              className={cn(
                "border-muted-foreground/30 text-text-secondary flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed text-xs",
                rowMediaUploadDisabled && "pointer-events-none opacity-50"
              )}
            >
              <input
                type="file"
                accept="image/*,video/*"
                className="sr-only"
                disabled={rowMediaUploadDisabled}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onRowFileSelect(index, file);
                  e.target.value = "";
                }}
              />
              + Add
            </label>
          ) : null}
        </div>
        <div className="min-w-0 flex-[2]">
          <Textarea
            name="captions"
            value={post.caption}
            onChange={(e) => onCaptionChange(index, e.target.value)}
            disabled={post.isKind6Repost}
            rows={4}
            placeholder={
              post.isKind6Repost
                ? "Kind 6 repost…"
                : post.isQuotePost
                  ? "Comment on quote…"
                  : "Caption…"
            }
            className="min-h-[96px] w-full resize-y text-base"
          />
        </div>
      </div>

      {advancedOpen ? (
        <BulkComposerPostAdvancedBlock
          index={index}
          post={post}
          queueTypes={queueTypes}
          userTimezone={userTimezone}
          queueTrigger={queueTrigger}
          showAlsoSchedule={showAlsoSchedule}
          bulkRepostConditions={bulkRepostConditions}
          showBatchRepostConditions={showBatchRepostConditions}
          onQueueTypeChange={onQueueTypeChange}
          onDateChange={onDateChange}
          onIsRecyclableChange={onIsRecyclableChange}
          onIncludeHashtagsInNoteBodyChange={onIncludeHashtagsInNoteBodyChange}
          onRepostSchedulesChange={onRepostSchedulesChange}
          onQuoteSchedulesChange={onQuoteSchedulesChange}
          scheduleOverlapWarning={scheduleOverlapWarning}
        />
      ) : null}
    </>
  );
}
