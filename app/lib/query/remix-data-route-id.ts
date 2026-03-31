/**
 * Remix client `fetch()` for loader JSON must pass `?_data=<route module id>`.
 * Route ids use file segments (e.g. `dashboard.scheduled.$queueType`), not URL
 * segments (so `/dashboard/scheduled/abc123` maps to
 * `routes/dashboard.scheduled.$queueType`, not `routes/dashboard.scheduled.abc123`).
 */

const QUEUE_FILTER_ROUTE_NAMES = new Set([
  "drafts",
  "recyclables",
  "scheduled",
  "published",
]);

/**
 * Maps a URL pathname to the Remix `_data` route id string.
 */
export function pathnameToRemixDataRouteId(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  const segments = trimmed.split("/").filter(Boolean);

  if (segments.length === 0) {
    return "routes/root";
  }

  if (segments.length === 1 && segments[0] === "dashboard") {
    return "routes/dashboard._index";
  }

  if (
    segments[0] === "dashboard" &&
    segments.length === 3 &&
    segments[1] &&
    QUEUE_FILTER_ROUTE_NAMES.has(segments[1]) &&
    segments[2]
  ) {
    return `routes/dashboard.${segments[1]}.$queueType`;
  }

  const dotted = segments.join(".");
  return `routes/${dotted}`;
}
