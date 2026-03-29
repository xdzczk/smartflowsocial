import { Temporal } from "@js-temporal/polyfill";

import type { BulkBatchMode } from "~/features/posts/bulk-composer/types";
import type { BulkPost } from "~/features/posts/types";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
import {
  formatForDisplay,
  parseDateTimeLocal,
  type DateDisplayLocale,
} from "~/lib/temporal";

function safeParseScheduled(
  scheduledFor: string,
  timezone: string
): Temporal.ZonedDateTime | null {
  const t = scheduledFor.trim();
  if (!t) return null;
  try {
    return parseDateTimeLocal(t, timezone);
  } catch {
    return null;
  }
}

export function reviewBatchStartLabel(
  posts: BulkPost[],
  timezone: string,
  timeFormat: "12h" | "24h",
  dateLocale: DateDisplayLocale
): string {
  const times = posts
    .map((p) => safeParseScheduled(p.scheduledFor, timezone))
    .filter((z): z is Temporal.ZonedDateTime => z != null);
  if (times.length === 0) return "—";
  const earliest = times.reduce((a, b) =>
    Temporal.ZonedDateTime.compare(a, b) <= 0 ? a : b
  );
  return formatForDisplay(
    earliest,
    timezone,
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    timeFormat,
    dateLocale
  );
}

/** Hours between consecutive scheduled posts when sorted by time; null if not a uniform interval. */
export function inferUniformScheduleIntervalHours(
  posts: BulkPost[],
  timezone: string
): number | null {
  const zoned = posts
    .map((p) => safeParseScheduled(p.scheduledFor, timezone))
    .filter((z): z is Temporal.ZonedDateTime => z != null)
    .sort(Temporal.ZonedDateTime.compare);
  if (zoned.length < 2) return null;
  const hours: number[] = [];
  for (let i = 1; i < zoned.length; i++) {
    const prev = zoned[i - 1]!;
    const cur = zoned[i]!;
    const ms = Number(cur.epochMilliseconds - prev.epochMilliseconds);
    hours.push(ms / 3_600_000);
  }
  const h0 = hours[0]!;
  const uniform = hours.every((h) => Math.abs(h - h0) < 1e-4);
  return uniform ? h0 : null;
}

export function reviewBatchIntervalLabel(
  posts: BulkPost[],
  timezone: string
): string {
  const h = inferUniformScheduleIntervalHours(posts, timezone);
  if (h == null) return posts.length >= 2 ? "Mixed" : "—";
  return formatIntervalLabel(h, { compact: false });
}

export function reviewBatchQueueDefaultLabel(posts: BulkPost[]): string {
  if (posts.length === 0) return "—";
  const keys = posts.map((p) =>
    p.queueType && p.queueType !== "unassigned" ? p.queueType : "unassigned"
  );
  const unique = new Set(keys);
  if (unique.size !== 1) return "Mixed";
  const only = [...unique][0]!;
  return only === "unassigned" ? "Unassigned" : only;
}

export function reviewScheduledRangeLabel(
  posts: BulkPost[],
  timezone: string,
  timeFormat: "12h" | "24h",
  dateLocale: DateDisplayLocale
): string {
  const zoned = posts
    .map((p) => safeParseScheduled(p.scheduledFor, timezone))
    .filter((z): z is Temporal.ZonedDateTime => z != null)
    .sort(Temporal.ZonedDateTime.compare);
  if (zoned.length === 0) return "—";
  const opts = {
    month: "short" as const,
    day: "numeric" as const,
    year: "numeric" as const,
    hour: "2-digit" as const,
    minute: "2-digit" as const,
  };
  const first = formatForDisplay(
    zoned[0]!,
    timezone,
    opts,
    timeFormat,
    dateLocale
  );
  const last = formatForDisplay(
    zoned[zoned.length - 1]!,
    timezone,
    opts,
    timeFormat,
    dateLocale
  );
  return first === last ? first : `${first} – ${last}`;
}

export function reviewQueueDistributionLabel(posts: BulkPost[]): string {
  if (posts.length === 0) return "—";
  const counts = new Map<string, number>();
  for (const p of posts) {
    const k =
      p.queueType && p.queueType !== "unassigned" ? p.queueType : "Unassigned";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([q, n]) => `${q}: ${n}`)
    .join(" · ");
}

export function countFollowUpOverridePosts(posts: BulkPost[]): number {
  return posts.filter(
    (p) =>
      (p.repostSchedules?.length ?? 0) > 0 ||
      (p.quoteSchedules?.length ?? 0) > 0
  ).length;
}

export function countTagsInNoteOffPosts(posts: BulkPost[]): number {
  return posts.filter((p) => p.includeHashtagsInNoteBody === false).length;
}

export function countNonRecyclablePosts(posts: BulkPost[]): number {
  return posts.filter((p) => !p.isRecyclable).length;
}

export function reviewSummaryExtraRows(input: {
  posts: BulkPost[];
  batchMode: BulkBatchMode;
  timezone: string;
  timeFormat: "12h" | "24h";
  dateLocale: DateDisplayLocale;
}): Array<{ label: string; value: string }> {
  const { posts, batchMode, timezone, timeFormat, dateLocale } = input;
  if (posts.length === 0) return [];

  const rows: Array<{ label: string; value: string }> = [];

  if (batchMode === "schedule") {
    rows.push({
      label: "Scheduled range",
      value: reviewScheduledRangeLabel(posts, timezone, timeFormat, dateLocale),
    });
  }

  rows.push({
    label: "Queue mix",
    value: reviewQueueDistributionLabel(posts),
  });

  const fu = countFollowUpOverridePosts(posts);
  rows.push({
    label: "Follow-up overrides",
    value: fu === 0 ? "None" : `${fu} post${fu !== 1 ? "s" : ""}`,
  });

  const tagsHidden = countTagsInNoteOffPosts(posts);
  rows.push({
    label: "Hide tags on",
    value:
      tagsHidden === 0
        ? "None"
        : `${tagsHidden} post${tagsHidden !== 1 ? "s" : ""}`,
  });

  const nonRec = countNonRecyclablePosts(posts);
  rows.push({
    label: "Non-recyclable",
    value: nonRec === 0 ? "None" : `${nonRec} post${nonRec !== 1 ? "s" : ""}`,
  });

  return rows;
}
