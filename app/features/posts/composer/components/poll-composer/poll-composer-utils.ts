import { parseScheduledTime } from "../composer/composer-submit-utils";

export const POLL_COMPOSER_MAX_OPTIONS = 10;
export const POLL_COMPOSER_MIN_OPTIONS = 2;
export const POLL_COMPOSER_SCHEDULE_FUTURE_MSG =
  "Schedule time must be in the future.";

export const POLL_MAX_HOURS_AFTER_PUBLISH = 8760;

export type PollEndMode = "absolute" | "relative";

export function randomScheduleHalfWidthSeconds(windowMinutes: number): number {
  if (!Number.isFinite(windowMinutes) || windowMinutes <= 0) return 0;
  return Math.min(Math.floor(windowMinutes * 60), 24 * 60 * 60);
}

export async function resolvePollEndsAtUnixForSubmit(params: {
  pollEndMode: PollEndMode;
  pollEndHoursAfterPublish: number;
  endsAtLocal: string;
  createdUnix: number;
  userTimezone: string;
}): Promise<
  { ok: true; endsAtUnix: number | undefined } | { ok: false; message: string }
> {
  if (params.pollEndMode === "relative") {
    const hours = params.pollEndHoursAfterPublish;
    if (
      !Number.isFinite(hours) ||
      hours < 1 ||
      hours > POLL_MAX_HOURS_AFTER_PUBLISH
    ) {
      return {
        ok: false,
        message: `Hours after publish must be between 1 and ${POLL_MAX_HOURS_AFTER_PUBLISH}.`,
      };
    }
    return {
      ok: true,
      endsAtUnix: params.createdUnix + Math.floor(hours * 3600),
    };
  }
  if (!params.endsAtLocal.trim()) {
    return { ok: true, endsAtUnix: undefined };
  }
  const endMs = await parseScheduledTime(
    params.endsAtLocal,
    params.userTimezone
  );
  const endsAtUnix = Math.floor(endMs / 1000);
  if (endsAtUnix <= params.createdUnix) {
    return { ok: false, message: "Poll end time must be after publish time." };
  }
  return { ok: true, endsAtUnix };
}

export function newPollOptionRowId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `opt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function parseTopicTagValues(hashtagLine: string): string[] {
  return hashtagLine
    .split(/\s+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => t.replace(/^#/u, ""));
}

function formatHashtagLineForNoteBody(hashtagLine: string): string {
  return hashtagLine
    .split(/\s+/u)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((t) => `#${t.replace(/^#/u, "")}`)
    .join(" ");
}

export function pollQuestionForSignedEvent(
  questionTrimmed: string,
  tagLine: string,
  appendTagsToBody: boolean
): string {
  const hashtagLineForBody = formatHashtagLineForNoteBody(tagLine);
  return appendTagsToBody && hashtagLineForBody
    ? `${questionTrimmed}\n${hashtagLineForBody}`.trim()
    : questionTrimmed;
}
