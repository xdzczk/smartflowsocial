/**
 * Reschedule modal body: post preview, datetime input, queue type, re-sign warning, errors.
 */

import { CalendarDays, Info } from "lucide-react";

import MediaThumbnail from "~/components/ui/MediaThumbnail";
import type { QueueType } from "~/features/posts/types";
import { isVideoFile } from "~/lib/helpers";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { getNowForDateTimeLocal } from "~/lib/temporal";

import type { CalendarPost } from "../PostBlock.types";

export interface RescheduleModalContentProps {
  post: CalendarPost;
  firstMedia: string | null;
  isEdit: boolean;
  editableDateTime: Date | null;
  userTimezone: string;
  formatDateTimeForInput: (date: Date, tz: string) => string;
  formatDateTime: (
    date: Date,
    tz: string,
    timeFormat: "12h" | "24h",
    dateLocale: "en-GB" | "en-US" | "en-CA"
  ) => string;
  userTimeFormat: "12h" | "24h";
  dateLocale: "en-GB" | "en-US" | "en-CA";
  handleDateTimeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selectedQueueType: string | null;
  setSelectedQueueType: (value: string | null) => void;
  queueTypes: QueueType[] | undefined;
  validationError: string | null;
  fetcherError: string | undefined;
  signingError: string | null;
}

export function RescheduleModalContent({
  post,
  firstMedia,
  isEdit,
  editableDateTime,
  userTimezone,
  formatDateTimeForInput,
  formatDateTime,
  userTimeFormat,
  dateLocale,
  handleDateTimeChange,
  selectedQueueType,
  setSelectedQueueType,
  queueTypes,
  validationError,
  fetcherError,
  signingError,
}: RescheduleModalContentProps) {
  return (
    <div className="space-y-4">
      {/* Post preview */}
      <div className="bg-secondary/30 rounded-lg p-3">
        <div className="text-foreground mb-2 text-sm font-medium">
          Post Preview:
        </div>

        {firstMedia ? (
          <div className="mb-2">
            <div className="post-thumbnail h-20 w-full overflow-hidden rounded-md">
              <MediaThumbnail
                src={firstMedia}
                alt="Post preview"
                className="h-full w-full rounded-md"
                forceType={isVideoFile(firstMedia) ? "video" : "image"}
                hidePlayButton={false}
                fallback={
                  <div className="bg-muted text-muted-foreground flex h-full w-full items-center justify-center text-xs font-medium">
                    {post.postType === "VIDEO" || isVideoFile(firstMedia)
                      ? "VIDEO"
                      : "MEDIA"}
                  </div>
                }
              />
            </div>
          </div>
        ) : null}

        <div className="text-muted-foreground text-sm">
          {post.caption ? (
            <span
              style={{
                display: "inline-block",
                maxWidth: "100%",
                wordBreak: "break-word",
                whiteSpace: "pre-line",
                overflowWrap: "anywhere",
              }}
            >
              {post.caption}
            </span>
          ) : (
            "No caption"
          )}
          {post.fileUrl.length > 0 ? (
            <span className="text-muted-foreground ml-2 text-xs">
              ({post.fileUrl.length} file
              {post.fileUrl.length > 1 ? "s" : ""})
            </span>
          ) : null}
        </div>
      </div>

      {/* New time */}
      <div className="space-y-2">
        <label
          htmlFor="reschedule-datetime"
          className="text-foreground block text-sm font-medium"
        >
          {isEdit ? "Edit scheduled time:" : "New time:"}
        </label>
        <div className="flex items-center space-x-2">
          <CalendarDays
            className="text-muted-foreground h-4 w-4"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          <input
            id="reschedule-datetime"
            type="datetime-local"
            value={
              editableDateTime
                ? formatDateTimeForInput(editableDateTime, userTimezone)
                : ""
            }
            min={getNowForDateTimeLocal(userTimezone)}
            onChange={handleDateTimeChange}
            className="border-border bg-background text-foreground focus:border-primary focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2"
          />
        </div>
        {editableDateTime ? (
          <div className="text-muted-foreground text-xs">
            {formatDateTime(
              editableDateTime,
              userTimezone,
              userTimeFormat,
              dateLocale
            )}
          </div>
        ) : null}
      </div>

      {/* Queue Type Selection */}
      <div className="space-y-2">
        <label
          htmlFor="reschedule-queue-type"
          className="text-foreground block text-sm font-medium"
        >
          Queue Type:
        </label>
        <select
          id="reschedule-queue-type"
          value={selectedQueueType ?? ""}
          onChange={(e) => setSelectedQueueType(e.target.value || null)}
          className="border-border bg-background text-foreground focus:border-primary focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2"
        >
          <option value="">Manual (No Queue)</option>
          {queueTypes?.map((queueType) => (
            <option key={queueType.id} value={queueType.id}>
              {queueType.name}
            </option>
          ))}
        </select>
        <div className="text-muted-foreground text-xs">
          {selectedQueueType
            ? "Post will be managed by the selected queue type"
            : "Post will be manually scheduled"}
        </div>
      </div>

      {/* Re-signing warning */}
      <div className="border-border bg-muted rounded-lg border p-3">
        <div className="flex items-start space-x-2">
          <Info
            className="text-primary mt-0.5 h-5 w-5 flex-shrink-0"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          <div>
            <div className="text-primary text-sm font-medium">
              {isEdit ? "Editing this post" : "Rescheduling this post"} requires
              re-signing the Nostr event
            </div>
            <div className="text-primary/80 mt-1 text-xs">
              Your Nostr client will prompt you to sign the updated event with
              the new timestamp.
            </div>
          </div>
        </div>
      </div>

      {validationError ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
          <div className="text-destructive text-sm">{validationError}</div>
        </div>
      ) : null}

      {(fetcherError ?? signingError) ? (
        <div className="border-destructive/30 bg-destructive/10 rounded-lg border p-3">
          <div className="text-destructive text-sm">
            {fetcherError ?? signingError}
          </div>
        </div>
      ) : null}
    </div>
  );
}
