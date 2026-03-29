import {
  formatForDisplay,
  fromUnixTimestamp,
  nowMillis,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

export type PollEndMode = "absolute" | "relative";

export interface PollPreviewEndInput {
  pollEndMode: PollEndMode;
  endsAtLocal: string;
  pollEndHoursAfterPublish: number;
  publishMode: "now" | "schedule" | "queue";
  scheduledFor: string;
  userTimezone: string;
  userTimeFormat: "12h" | "24h";
}

/**
 * Human-readable poll end line for preview (mirrors PollComposer nominal unix logic).
 */
export function getPollPreviewEndLabel(input: PollPreviewEndInput): string {
  if (input.pollEndMode === "relative") {
    const h = input.pollEndHoursAfterPublish;
    if (!Number.isFinite(h) || h < 1) {
      return "End time: set hours after publish";
    }
    const nominalPublishUnixSecForPreview =
      input.publishMode === "now"
        ? Math.floor(nowMillis() / 1000)
        : input.scheduledFor.trim()
          ? (() => {
              try {
                return Math.floor(
                  toUnixTimestamp(
                    parseDateTimeLocal(
                      input.scheduledFor.trim(),
                      input.userTimezone
                    )
                  )
                );
              } catch {
                return null;
              }
            })()
          : null;
    if (nominalPublishUnixSecForPreview == null) {
      return `Closes ${h} hour${h === 1 ? "" : "s"} after publish (set schedule for exact time)`;
    }
    const endUnix = nominalPublishUnixSecForPreview + Math.floor(h * 3600);
    const zdt = fromUnixTimestamp(endUnix, input.userTimezone);
    const formatted = formatForDisplay(
      zdt,
      input.userTimezone,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
      input.userTimeFormat
    );
    return `Ends ${formatted}`;
  }

  const endLocal = input.endsAtLocal.trim();
  if (!endLocal) {
    return "No end date set";
  }
  try {
    const zdt = parseDateTimeLocal(endLocal, input.userTimezone);
    const formatted = formatForDisplay(
      zdt,
      input.userTimezone,
      {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      },
      input.userTimeFormat
    );
    return `Ends ${formatted}`;
  } catch {
    return "Invalid end date";
  }
}
