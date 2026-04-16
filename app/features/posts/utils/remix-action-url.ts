import { pathnameToRemixDataRouteId } from "~/lib/query/remix-data-route-id";

/**
 * Builds a URL with the Remix `_data` parameter so a bare `fetch()` POST
 * returns the action's JSON response instead of a full HTML document.
 */
export function buildActionUrl(pathname: string): string {
  const routeId = pathnameToRemixDataRouteId(pathname);
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}_data=${encodeURIComponent(routeId)}`;
}
