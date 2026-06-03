import { formatIntervalLabel } from "~/lib/schedule-intervals";

import { isQueuePaused } from "../queue-status";
import {
  isFixedSlotsScheduleConfig,
  isIntervalScheduleConfig,
  isWeeklySlotsScheduleConfig,
} from "../types";
import type { QueueType } from "../types";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const MAX_GLOBAL_LABELS = 5;

function getRandomWindowMinutes(
  scheduleType: QueueType["scheduleType"],
  scheduleConfig: QueueType["scheduleConfig"] | undefined
): number {
  if (!scheduleConfig || typeof scheduleConfig !== "object") {
    return 0;
  }
  const raw = (scheduleConfig as { scheduleRandomWindowMinutes?: unknown })
    .scheduleRandomWindowMinutes;
  return typeof raw === "number" && raw > 0 ? raw : 0;
}

function formatGlobalPicksSummary(hours: number[]): string {
  if (hours.length === 0) {
    return "Composer quick picks";
  }
  const labels = hours
    .slice(0, MAX_GLOBAL_LABELS)
    .map((h) => formatIntervalLabel(h));
  const extra = hours.length > MAX_GLOBAL_LABELS ? ", …" : "";
  return `${labels.join(", ")}${extra}`;
}

/**
 * Single primary schedule line for queue list rows (user-facing, not implementation jargon).
 */
export function getQueuePrimaryScheduleLine(
  queueType: QueueType & { scheduleConfig?: QueueType["scheduleConfig"] },
  globalScheduleIntervalHours: number[]
): string {
  const { scheduleType, scheduleConfig } = queueType;
  if (!scheduleConfig) {
    return "No schedule configured";
  }

  if (scheduleType === "INTERVAL") {
    if (isIntervalScheduleConfig(scheduleConfig)) {
      if (scheduleConfig.useGlobalInterval) {
        const detail = formatGlobalPicksSummary(globalScheduleIntervalHours);
        return `Interval · ${detail}`;
      }
      const h = scheduleConfig.intervalHours;
      if (typeof h === "number" && Number.isFinite(h) && h > 0) {
        const every = formatIntervalLabel(h);
        return `Interval · Every ${every}`;
      }
    }
    return "Interval · Configure hours or global picks";
  }

  if (scheduleType === "WEEKLY_SLOTS") {
    if (isWeeklySlotsScheduleConfig(scheduleConfig)) {
      const parts = scheduleConfig.weeklySlots.map(
        (slot) => `${DAY_SHORT[slot.dayOfWeek] ?? "?"} ${slot.time}`
      );
      const joined = parts.join(", ");
      return joined
        ? `Weekly slots · ${joined}`
        : "Weekly slots · Add day and time";
    }
    return "Weekly slots · Invalid configuration";
  }

  if (scheduleType === "FIXED_SLOTS") {
    if (isFixedSlotsScheduleConfig(scheduleConfig)) {
      const joined = scheduleConfig.slots.join(", ");
      return joined ? `Fixed slots · ${joined}` : "Fixed slots · Add times";
    }
    return "Fixed slots · Invalid configuration";
  }

  return "Schedule not configured";
}

export interface QueueMetadataChip {
  key: string;
  label: string;
}

/**
 * Up to `max` compact chips for queue rows (preset, flags, global, randomization).
 */
export function getQueueMetadataChips(
  queueType: QueueType,
  max = 4
): QueueMetadataChip[] {
  const chips: QueueMetadataChip[] = [];

  if (isQueuePaused(queueType)) {
    chips.push({ key: "paused", label: "Paused" });
  }

  const preset = queueType.hashTagPreset;
  if (preset?.name) {
    chips.push({ key: "preset", label: `Preset: ${preset.name}` });
  }

  if (queueType.includeHashtagsInNoteBody === false) {
    chips.push({ key: "tags-hidden", label: "Tags hidden" });
  }

  const st = queueType.scheduleType;
  const cfg = queueType.scheduleConfig;
  if (
    st === "INTERVAL" &&
    isIntervalScheduleConfig(cfg) &&
    cfg.useGlobalInterval
  ) {
    chips.push({ key: "global", label: "Global schedule" });
  }

  const rw = getRandomWindowMinutes(st, cfg);
  if (rw > 0) {
    chips.push({ key: "random", label: `Randomized ±${rw}m` });
  }

  return chips.slice(0, max);
}
