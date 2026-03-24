import type { LoaderFunctionArgs } from "@remix-run/node";

import { applyUnsubscribeFromRawToken } from "~/features/broadcast/broadcast-unsubscribe.server";

const UNSUBSCRIBE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Unsubscribe</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.5; color: #111; }
    @media (prefers-color-scheme: dark) { body { background: #111; color: #eee; } }
  </style>
</head>
<body>
  <p>If this link was valid, you will no longer receive broadcasts from this sender.</p>
  <p>You can close this page.</p>
</body>
</html>`;

/**
 * Public GET: no auth. Uses opaque token in <code>?t=</code>; response does not distinguish invalid vs valid tokens.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }
  const url = new URL(request.url);
  const t = url.searchParams.get("t");
  await applyUnsubscribeFromRawToken(t);
  return new Response(UNSUBSCRIBE_HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
      "Cache-Control": "no-store",
    },
  });
}

export default function BroadcastUnsubscribePage() {
  return null;
}
