/**
 * Helpers for client-side date range filtering (Scheduled / Published pages).
 * Dates are compared by calendar day (YYYY-MM-DD); time is ignored.
 */

function toDateOnly(d: Date | string | null | undefined): string | null {
  if (d == null) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns true if the given date falls within [from, to] (inclusive).
 * - If from is empty, no lower bound.
 * - If to is empty, no upper bound.
 */
export function isDateInRange(
  date: Date | string | null | undefined,
  from: string,
  to: string
): boolean {
  const dateStr = toDateOnly(date);
  if (dateStr == null) return false;
  if (from && dateStr < from) return false;
  if (to && dateStr > to) return false;
  return true;
}
