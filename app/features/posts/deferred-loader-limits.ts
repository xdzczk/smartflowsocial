/**
 * Max rows for scheduled-posts loader when `dateFrom` / `dateTo` filters are active.
 * Prevents unbounded queries (legacy limit was 5000).
 */
export const SCHEDULED_DATE_RANGE_QUERY_LIMIT = 1000;
