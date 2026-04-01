import type { LoaderFunctionArgs } from "@remix-run/node";

import { getSiteOrigin } from "~/lib/site-url.server";

/**
 * Dynamic robots.txt so `Sitemap:` matches `APP_URL` (or request origin in dev).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const origin = getSiteOrigin(request);
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api",
    "Disallow: /dashboard",
    "Disallow: /auth/",
    "Disallow: /internal/",
    "Disallow: /logout",
    "Disallow: /login",
    "Disallow: /notification-handler",
    "Disallow: /healthcheck",
    "Disallow: /media/",
    "Disallow: /broadcast/",
    "Disallow: /cron/",
    "",
    `Sitemap: ${origin}/sitemap.xml`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
