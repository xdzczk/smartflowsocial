import { Temporal } from "@js-temporal/polyfill";

import { formatIntervalLabel } from "~/lib/schedule-intervals";
import { fromDate } from "~/lib/temporal";

import { isQueuePaused } from "../queue-status";
import {
  isFixedSlotsScheduleConfig,
  isIntervalScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";
import type { CombinedContent, QueueType } from "../types";

function normalizeGlobalHours(raw: number[]): number[] {
  return raw.map((h) => Number(h)).filter((h) => Number.isFinite(h) && h > 0);
}

/**
 * Steady-state posts per day implied by the queue schedule (for runway = posts / rate).
 * Returns 0 when the queue is disabled, null when the rate cannot be determined.
 */
export function estimatePostsPerDayForQueue(
  queueType: QueueType,
  globalScheduleIntervalHours: number[]
): number | null {
  if (isQueuePaused(queueType)) return 0;
  const st = queueType.scheduleType;
  const cfg = queueType.scheduleConfig;
  if (!st || !cfg) return null;

  if (st === "INTERVAL" && isIntervalScheduleConfig(cfg)) {
    if (cfg.useGlobalInterval) {
      const hours = normalizeGlobalHours(globalScheduleIntervalHours);
      if (hours.length === 0) return null;
      return 24 / Math.min(...hours);
    }
    const h = cfg.intervalHours;
    if (typeof h === "number" && h > 0) return 24 / h;
    return null;
  }
  if (st === "FIXED_SLOTS" && isFixedSlotsScheduleConfig(cfg)) {
    const n = cfg.slots.length;
    return n > 0 ? n : null;
  }
  if (st === "WEEKLY_SLOTS" && isWeeklySlotsScheduleConfig(cfg)) {
    const n = cfg.weeklySlots.length;
    return n > 0 ? n / 7 : null;
  }
  return null;
}

/** Compact cadence hint for queue rows (e.g. daily 2, weekly). */
export function formatShortCadenceLabel(
  queueType: QueueType,
  globalScheduleIntervalHours: number[]
): string | null {
  const custom =
    queueType.cadenceLabel != null &&
    String(queueType.cadenceLabel).trim() !== ""
      ? String(queueType.cadenceLabel).trim()
      : null;
  if (custom) return custom;

  const st = queueType.scheduleType;
  const cfg = queueType.scheduleConfig;
  if (!st || !cfg) return null;

  if (st === "INTERVAL" && isIntervalScheduleConfig(cfg)) {
    if (cfg.useGlobalInterval) {
      const hours = normalizeGlobalHours(globalScheduleIntervalHours);
      if (hours.length === 0) return "Global interval";
      const labels = hours
        .slice(0, 3)
        .map((h) => formatIntervalLabel(h))
        .join(", ");
      const extra = hours.length > 3 ? ", …" : "";
      return `Global · ${labels}${extra}`;
    }
    const h = cfg.intervalHours;
    if (typeof h === "number" && h > 0) {
      return `Every ${formatIntervalLabel(h)}`;
    }
    return "Interval";
  }
  if (st === "FIXED_SLOTS" && isFixedSlotsScheduleConfig(cfg)) {
    const n = cfg.slots.length;
    if (n <= 0) return "Daily";
    return `daily ${n}`;
  }
  if (st === "WEEKLY_SLOTS" && isWeeklySlotsScheduleConfig(cfg)) {
    const n = cfg.weeklySlots.length;
    if (n <= 0) return "weekly";
    return n === 1 ? "weekly" : `weekly · ${n} slots`;
  }
  return null;
}

export function formatQueueRunwayDaysLabel(
  postsInQueue: number,
  postsPerDay: number | null
): string {
  if (postsPerDay === 0) return "—";
  if (postsPerDay == null || postsPerDay <= 0) return "—";
  if (postsInQueue <= 0) return "0 days";
  const days = Math.ceil(postsInQueue / postsPerDay);
  return `${days} day${days !== 1 ? "s" : ""}`;
}

function formatPostsPerDayRateSuffix(
  postsPerDayEstimate: number | null
): string {
  if (postsPerDayEstimate == null || postsPerDayEstimate <= 0) return "";
  const rounded =
    postsPerDayEstimate >= 10
      ? Math.round(postsPerDayEstimate)
      : Number(postsPerDayEstimate.toFixed(1));
  return ` · ~${rounded}/day`;
}

function formatGlobalIntervalCadenceRich(
  globalScheduleIntervalHours: number[],
  postsPerDayEstimate: number | null
): string {
  const hours = normalizeGlobalHours(globalScheduleIntervalHours);
  if (hours.length === 0) return "Global interval";
  const labels = hours
    .slice(0, 3)
    .map((h) => formatIntervalLabel(h))
    .join(", ");
  const extra = hours.length > 3 ? ", …" : "";
  return `Global · ${labels}${extra}${formatPostsPerDayRateSuffix(postsPerDayEstimate)}`;
}

function formatPrivateIntervalCadenceRich(
  intervalHours: number,
  postsPerDayEstimate: number | null
): string {
  return `Every ${formatIntervalLabel(intervalHours)}${formatPostsPerDayRateSuffix(postsPerDayEstimate)}`;
}

/** Dashboard Queues row: richer cadence copy than {@link formatShortCadenceLabel}. */
export function formatQueueCadenceRichDisplay(
  queueType: QueueType,
  globalScheduleIntervalHours: number[],
  postsPerDayEstimate: number | null
): string | null {
  const custom =
    queueType.cadenceLabel != null &&
    String(queueType.cadenceLabel).trim() !== ""
      ? String(queueType.cadenceLabel).trim()
      : null;
  if (custom) return custom;

  const st = queueType.scheduleType;
  const cfg = queueType.scheduleConfig;
  if (!st || !cfg) return null;

  if (st === "INTERVAL" && isIntervalScheduleConfig(cfg)) {
    if (cfg.useGlobalInterval) {
      return formatGlobalIntervalCadenceRich(
        globalScheduleIntervalHours,
        postsPerDayEstimate
      );
    }
    const h = cfg.intervalHours;
    if (typeof h === "number" && h > 0) {
      return formatPrivateIntervalCadenceRich(h, postsPerDayEstimate);
    }
    return "Interval";
  }
  if (st === "FIXED_SLOTS" && isFixedSlotsScheduleConfig(cfg)) {
    const n = cfg.slots.length;
    if (n <= 0) return "Every day";
    return n === 1 ? "Every day · 1 post" : `${n}/day · every day`;
  }
  if (st === "WEEKLY_SLOTS" && isWeeklySlotsScheduleConfig(cfg)) {
    const n = cfg.weeklySlots.length;
    if (n <= 0) return "Weekly";
    return n === 1 ? "Weekly · 1 slot" : `Weekly · ${n} slots`;
  }
  return null;
}

function queueHoldStatusFromCombined(
  item: CombinedContent
): string | undefined {
  const od = item.originalData as { queueHoldStatus?: string | undefined };
  return od.queueHoldStatus;
}

function isAttachedFollowUpPost(item: CombinedContent): boolean {
  if (item.type !== "post") return false;
  if (item.dependencyMode === "attached") return true;
  const od = item.originalData as { dependencyMode?: string | null };
  return od.dependencyMode === "attached";
}

/**
 * Earliest future scheduled time per queue name from loaded flow items (no new API).
 * Skips held rows, attached follow-ups, and non-scheduled states.
 */
export function buildEarliestNextScheduledUtcMsByQueueFromFlow(
  flowItems: CombinedContent[],
  referenceNowMs: number
): Record<string, number> {
  const map = new Map<string, number>();
  for (const item of flowItems) {
    if (item.currentState !== "SCHEDULED") continue;
    if (item.repost) continue;
    if (isAttachedFollowUpPost(item)) continue;
    if (queueHoldStatusFromCombined(item) === "HELD_BY_QUEUE") continue;
    const name = item.queueType?.name;
    const sched = item.scheduledAtUtc;
    if (!name || !sched) continue;
    const ms =
      sched instanceof Date ? sched.getTime() : new Date(sched).getTime();
    if (!Number.isFinite(ms) || ms <= referenceNowMs) continue;
    const prev = map.get(name);
    if (prev == null || ms < prev) map.set(name, ms);
  }
  return Object.fromEntries(map);
}

/**
 * Human “Next: …” line from absolute scheduled time (uses loaded flow slice).
 */
export function formatNextQueuePostLine(
  nextUtcMs: number,
  referenceNowMs: number,
  timeZone: string,
  hour12: boolean
): string {
  const diff = nextUtcMs - referenceNowMs;
  const oneMinute = 60 * 1000;
  const oneHour = 60 * oneMinute;

  if (diff <= 0) return "Next: soon";

  if (diff < oneHour) {
    const mins = Math.max(1, Math.floor(diff / oneMinute));
    return `Next: in ${mins}m`;
  }

  if (diff < 24 * oneHour) {
    const hours = Math.max(1, Math.floor(diff / oneHour));
    return `Next: in ${hours}h`;
  }

  const nowZ =
    Temporal.Instant.fromEpochMilliseconds(referenceNowMs).toZonedDateTimeISO(
      timeZone
    );
  const nextZ = fromDate(new Date(nextUtcMs), timeZone);
  const todayPlain = nowZ.toPlainDate();
  const nextPlain = nextZ.toPlainDate();
  const daySpan = todayPlain.until(nextPlain, { largestUnit: "day" });
  const dayCount =
    typeof daySpan.days === "number" ? daySpan.days : Number(daySpan.days);

  const timeFmt = new Intl.DateTimeFormat(undefined, {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });
  const timePart = timeFmt.format(new Date(nextUtcMs));

  if (dayCount === 0) {
    return `Next: today ${timePart}`;
  }
  if (dayCount === 1) {
    return `Next: tomorrow ${timePart}`;
  }
  if (dayCount < 7) {
    const weekdayFmt = new Intl.DateTimeFormat(undefined, {
      timeZone,
      weekday: "short",
    });
    const wd = weekdayFmt.format(new Date(nextUtcMs));
    return `Next: ${wd} ${timePart}`;
  }

  const dateFmt = new Intl.DateTimeFormat(undefined, {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12,
  });
  return `Next: ${dateFmt.format(new Date(nextUtcMs))}`;
}
