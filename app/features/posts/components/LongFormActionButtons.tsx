import { Button } from "~/components/ui/button";

interface LongFormActionButtonsProps {
  fetcherState: "idle" | "submitting" | "loading";
  isFormValid: boolean;
  hasScheduledFor: boolean;
  scheduledFor?: string | null;
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

export function LongFormActionButtons({
  fetcherState,
  isFormValid,
  hasScheduledFor,
  scheduledFor = null,
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

  return (
    <div className="pt-4">
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
          <svg
            className="mr-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
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
