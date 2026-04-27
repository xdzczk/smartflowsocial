import { formatIntervalLabel } from "~/lib/schedule-intervals";

import { isQueuePaused } from "../queue-status";
import {
  isFixedSlotsScheduleConfig,
  isIntervalScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";
import type { QueueType } from "../types";

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
