import { env } from "~/lib/env.server";

/**
 * Canonical public origin for absolute URLs (OG images, canonical links, sitemap).
 * Prefer `APP_URL` when set; otherwise the request URL (local/staging).
 */
export function getSiteOrigin(request: Request): string {
  const raw = env.APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).origin;
    } catch {
      // fall through
    }
  }
  return new URL(request.url).origin;
}

export function absoluteUrl(siteOrigin: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin}${p}`;
}
