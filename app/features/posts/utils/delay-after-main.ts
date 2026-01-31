/**
 * Delay after main post (hours or minutes) for repost/quote scheduling.
 */

export type DelayUnit = "hours" | "minutes";

export interface DelayAfterMain {
  value: number;
  unit: DelayUnit;
}

/** Convert delay to seconds from main post time. */
export function delayAfterMainToSeconds(d: DelayAfterMain): number {
  return d.unit === "hours" ? d.value * 3600 : d.value * 60;
}

/** Validate delay: value must be >= 1. */
export function isValidDelayAfterMain(d: DelayAfterMain): boolean {
  return typeof d.value === "number" && d.value >= 1;
}
