/**
 * Allowed schedule interval values (in hours).
 * Only 0.25 (15 min), 0.5 (30 min), and whole hours are valid.
 */
export const ALLOWED_SCHEDULE_INTERVAL_HOURS: number[] = [
  0.25, 0.5, 1, 2, 3, 4, 6, 8, 12, 24,
];

/** Fixed quick-pick intervals used by composer schedule pills. */
export const COMPOSER_QUICK_SCHEDULE_INTERVAL_HOURS: number[] = [
  0.25, 0.5, 1, 3, 24,
];

/**
 * Returns true if the value is an allowed schedule interval (0.25, 0.5, or a positive integer).
 */
export function isAllowedScheduleInterval(value: number): boolean {
  if (value === 0.25 || value === 0.5) return true;
  return Number.isInteger(value) && value > 0;
}

/**
 * Format an interval in hours for display (e.g. "15 min", "30 min", "2 hours").
 * @param hours - Interval in hours (e.g. 0.25, 0.5, 2)
 * @param options.compact - If true, use short form with "+" prefix for buttons (e.g. "+15 min", "+2h")
 */
export function formatIntervalLabel(
  hours: number,
  options?: { compact?: boolean }
): string {
  const prefix = options?.compact ? "+" : "";
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return options?.compact ? `${prefix}${minutes} min` : `${minutes} min`;
  }
  if (options?.compact) {
    return `${prefix}${hours}h`;
  }
  return hours === 1 ? "1 hour" : `${hours} hours`;
}
