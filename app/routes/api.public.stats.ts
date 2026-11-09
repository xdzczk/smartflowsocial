import { json, type LoaderFunctionArgs } from "@remix-run/node";

import {
  allowedStatsOrigin,
  getPublicStats,
  publicStatsEnabled,
} from "~/features/public-stats/public-stats.server";
import { redis } from "~/infra/queue/queue-client.server";
import { env } from "~/lib/env.server";

const WINDOW_SECONDS = 60;
const MAX_PER_WINDOW = 60;

async function limited(request: Request): Promise<boolean> {
  if (env.NODE_ENV === "test" || env.DISABLE_RATE_LIMIT === "true") {
    return false;
  }
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  try {
    const key = `smartflow:public-stats:rl:${ip}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    return count > MAX_PER_WINDOW;
  } catch {
    return false;
  }
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "cache-control": "public, max-age=900, stale-while-revalidate=3600",
    vary: "Origin",
  });
  const origin = allowedStatsOrigin(request);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

export async function loader({ request }: LoaderFunctionArgs) {
  if (!publicStatsEnabled()) {
    return new Response("Not found", { status: 404 });
  }
  if (await limited(request)) {
    return json({ error: "Too many requests" }, { status: 429 });
  }
  const origin = new URL(request.url).origin;
  const stats = await getPublicStats(origin);
  return json(stats, { headers: corsHeaders(request) });
}
