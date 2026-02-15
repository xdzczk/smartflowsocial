/**
 * Parse YYYY-MM-DD query params to UTC date range (start of day, end of day).
 * Used by Scheduled and Published loaders for server-side date filtering.
 */

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateOnly(s: string): boolean {
  if (!DATE_ONLY_REGEX.test(s)) return false;
  const d = new Date(s + "T00:00:00.000Z");
  return !Number.isNaN(d.getTime());
}

/**
 * Returns { fromUtc, toUtc } for the given date strings (YYYY-MM-DD).
 * - fromUtc: start of that day in UTC (00:00:00.000), only if dateFrom is valid
 * - toUtc: end of that day in UTC (23:59:59.999), only if dateTo is valid
 * Returns undefined if both are missing or invalid.
 */
export function parseDateRangeUtc(
  dateFrom?: string | null,
  dateTo?: string | null
): { fromUtc?: Date; toUtc?: Date } | undefined {
  const from = dateFrom?.trim();
  const to = dateTo?.trim();
  if (!from && !to) return undefined;
  const hasFrom = from && isValidDateOnly(from);
  const hasTo = to && isValidDateOnly(to);
  if (!hasFrom && !hasTo) return undefined;

  const fromUtc = hasFrom
    ? new Date(
        Date.UTC(
          parseInt(from.slice(0, 4), 10),
          parseInt(from.slice(5, 7), 10) - 1,
          parseInt(from.slice(8, 10), 10),
          0,
          0,
          0,
          0
        )
      )
    : undefined;
  const toUtc = hasTo
    ? new Date(
        Date.UTC(
          parseInt(to.slice(0, 4), 10),
          parseInt(to.slice(5, 7), 10) - 1,
          parseInt(to.slice(8, 10), 10),
          23,
          59,
          59,
          999
        )
      )
    : undefined;

  return { fromUtc, toUtc };
}
