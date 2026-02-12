/**
 * Proxy for notification assets (e.g. profile pictures) so push payloads
 * can use same-origin URLs. iOS often does not display images from
 * cross-origin URLs in push notifications.
 *
 * GET /api/notification-asset?url=<encoded-https-url>
 * - Validates url (HTTPS only; host allowlist).
 * - Fetches the image and streams it back with appropriate headers.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";

import { ValidationError } from "~/lib/errors";

const ALLOWED_HOSTS = [
  "m.primal.net",
  "primal.net",
  "cdn.nostr.build",
  "nostr.build",
  "i.nostr.build",
  "img.nostr.build",
  "image.nostr.build",
  "media.nostr.band",
  "nostr.band",
  "void.cat",
  "cdn.void.cat",
];

const FETCH_TIMEOUT_MS = 8000;
const CACHE_MAX_AGE = 24 * 60 * 60; // 24 hours

function isAllowedUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`)
  );
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const targetParam = url.searchParams.get("url");

  if (!targetParam || targetParam.trim() === "") {
    throw new ValidationError("Missing url parameter", {
      searchParams: Array.from(url.searchParams.entries()),
    });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(targetParam);
  } catch {
    throw new ValidationError("Invalid URL format", { targetUrl: targetParam });
  }

  if (targetUrl.protocol !== "https:") {
    throw new ValidationError("URL must be HTTPS", { targetUrl: targetParam });
  }

  if (!isAllowedUrl(targetUrl)) {
    throw new ValidationError("URL host not allowed for notification assets", {
      host: targetUrl.hostname,
    });
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent": "Smartflow-Notification-Asset/1.0",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    throw new ValidationError("Failed to fetch asset", {
      targetUrl: targetParam,
      reason: error instanceof Error ? error.message : String(error),
    });
  }

  if (!upstream.ok) {
    throw new ValidationError("Upstream returned error", {
      targetUrl: targetParam,
      status: upstream.status,
    });
  }

  const contentType =
    upstream.headers.get("content-type")?.split(";")[0]?.trim() ?? "image/jpeg";
  const isImage =
    contentType.startsWith("image/") ||
    contentType === "application/octet-stream";

  if (!isImage) {
    throw new ValidationError("Upstream response is not an image", {
      targetUrl: targetParam,
      contentType,
    });
  }

  const body = upstream.body;
  if (!body) {
    throw new ValidationError("Upstream response has no body", {
      targetUrl: targetParam,
    });
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, stale-while-revalidate=86400`,
    },
  });
}
