import { Eye } from "lucide-react";

import { Button } from "~/components/ui/button";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";

interface LongFormActionButtonsProps {
  fetcherState: "idle" | "submitting" | "loading";
  isFormValid: boolean;
  hasScheduledFor: boolean;
  scheduledFor?: string | null;
  /** Shown above buttons when draft (no schedule) */
  statusLabel?: string;
  /** Shown above buttons when scheduled (e.g. "Scheduled for Jan 15, 2:00 PM") */
  scheduledForLabel?: string;
  /** When set, show "Last saved X ago" */
  lastSavedAt?: Date | null;
  /** When set, show "Couldn't save draft" */
  autosaveError?: string | null;
  /** Shown in panel next to status (e.g. "234 words") */
  wordCount?: number;
  isSigning?: boolean;
  onPreview: () => void;
  onSchedule: () => void;
  onPublish: () => void;
}

function formatScheduleLabel(scheduledFor: string): string {
  try {
    const date = new Date(scheduledFor);
    if (Number.isNaN(date.getTime())) return "Schedule";
    const month = date.toLocaleString("default", { month: "short" });
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const time =
      minutes > 0
        ? `${hours}:${String(minutes).padStart(2, "0")}`
        : `${hours}:00`;
    return `Schedule for ${month} ${day}, ${time}`;
  } catch {
    return "Schedule";
  }
}

function formatLastSaved(at: Date): string {
  const sec = Math.floor((Date.now() - at.getTime()) / 1000);
  if (sec < 60) return "Last saved just now";
  if (sec < 3600) return `Last saved ${Math.floor(sec / 60)} min ago`;
  if (sec < 86400) return `Last saved ${Math.floor(sec / 3600)} hr ago`;
  return `Last saved ${Math.floor(sec / 86400)} day ago`;
}

export function LongFormActionButtons({
  fetcherState,
  isFormValid,
  hasScheduledFor,
  scheduledFor = null,
  statusLabel,
  scheduledForLabel,
  lastSavedAt,
  autosaveError,
  wordCount = 0,
  isSigning = false,
  onPreview,
  onSchedule,
  onPublish,
}: LongFormActionButtonsProps) {
  const isDisabled = fetcherState !== "idle" || !isFormValid || isSigning;
  const scheduleLabel =
    hasScheduledFor && scheduledFor
      ? formatScheduleLabel(scheduledFor)
      : "Schedule";
  const statusLine =
    scheduledForLabel ??
    autosaveError ??
    (lastSavedAt ? formatLastSaved(lastSavedAt) : statusLabel);
  const showWordCount = wordCount > 0;

  return (
    <div className="pt-4">
      {statusLine || showWordCount ? (
        <div className="text-muted-foreground mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          {statusLine ? (
            <span className={autosaveError ? "text-destructive" : undefined}>
              {statusLine}
            </span>
          ) : null}
          {showWordCount ? (
            <span>
              {wordCount} {wordCount === 1 ? "word" : "words"}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          name="_action"
          value="save-draft"
          variant="outline"
          disabled={isDisabled}
          className="border-border dark:border-border flex-1 sm:min-w-[140px] sm:flex-none"
        >
          {fetcherState !== "idle" ? "Saving..." : "Save Draft"}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={onPreview}
          disabled={!isFormValid}
          className="border-border dark:border-border flex-1 sm:min-w-[140px] sm:flex-none"
        >
          <Eye
            className={`mr-2 ${INLINE_ICON_SIZE_CLASS}`}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Preview Article
        </Button>

        {hasScheduledFor ? (
          <Button
            type="button"
            onClick={onSchedule}
            disabled={isDisabled}
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex-1 px-8 font-medium"
          >
            {isSigning
              ? "Waiting for signer…"
              : fetcherState !== "idle"
                ? "Scheduling..."
                : scheduleLabel}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onPublish}
            disabled={isDisabled}
            className="bg-success hover:bg-success/90 flex-1 px-8 font-medium text-white"
          >
            {isSigning
              ? "Waiting for signer…"
              : fetcherState !== "idle"
                ? "Publishing..."
                : "Publish to NOSTR"}
          </Button>
        )}
      </div>
    </div>
  );
}
