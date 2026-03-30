import {
  formatForDateTimeLocal,
  fromUnixTimestamp,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

export const MAX_HOURS_AFTER_PUBLISH = 8760;

/** Publish anchor for contest activation (rail: Now vs Schedule). */
export function nominalPublishUnixSecForContest(params: {
  launchMode: "now" | "schedule";
  scheduledActivationFor: string;
  userTimezone: string;
}): number | null {
  if (params.launchMode === "now") {
    return Math.floor(Date.now() / 1000);
  }
  const t = params.scheduledActivationFor.trim();
  if (!t) return null;
  try {
    return Math.floor(
      toUnixTimestamp(parseDateTimeLocal(t, params.userTimezone))
    );
  } catch {
    return null;
  }
}

/** Contest end as datetime-local string when using hours-after-publish. */
export function computeRelativeContestEndLocalString(params: {
  launchMode: "now" | "schedule";
  scheduledActivationFor: string;
  userTimezone: string;
  hours: number;
}): string | null {
  const publishUnix = nominalPublishUnixSecForContest({
    launchMode: params.launchMode,
    scheduledActivationFor: params.scheduledActivationFor,
    userTimezone: params.userTimezone,
  });
  if (publishUnix == null) return null;
  if (
    !Number.isFinite(params.hours) ||
    params.hours < 1 ||
    params.hours > MAX_HOURS_AFTER_PUBLISH
  ) {
    return null;
  }
  const endUnix = publishUnix + Math.floor(params.hours * 3600);
  return formatForDateTimeLocal(
    fromUnixTimestamp(endUnix, params.userTimezone),
    params.userTimezone
  );
}
