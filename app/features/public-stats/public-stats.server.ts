import { env } from "~/lib/env.server";
import { logWarning } from "~/lib/error-logger.server";
import { nostrAdapter } from "~/lib/nostr-adapter.server";
import {
  deleteFromRedis,
  getJsonFromRedis,
  setJsonInRedis,
} from "~/lib/redis-cache.server";

import {
  queryPublicStats,
  saveStatsSnapshot,
} from "./repositories/public-stats-data.server";
import { toPublicNpub, type PublicStats } from "./stats-payload";

const CACHE_NAME = "public-stats";
const CACHE_KEY = "smartflow:public-stats:v2";
const CACHE_TTL_SECONDS = 15 * 60;

export function publicStatsEnabled(): boolean {
  return env.PUBLIC_STATS_ENABLED !== "false";
}

const DEFAULT_ORIGINS = [
  "https://smartflow.social",
  "https://www.smartflow.social",
  "http://localhost:4321",
  "http://127.0.0.1:4321",
];

export function allowedStatsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const extra = (env.LANDING_STATS_ORIGINS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return DEFAULT_ORIGINS.includes(origin) || extra.includes(origin)
    ? origin
    : null;
}

export async function getPublicStats(
  pictureOrigin: string
): Promise<PublicStats> {
  const cached = await getJsonFromRedis<PublicStats>({
    cache: CACHE_NAME,
    key: CACHE_KEY,
  });
  if (cached.hit) return cached.value;

  const stats = await queryPublicStats(pictureOrigin);
  const origin = pictureOrigin.replace(/\/$/, "");
  stats.people = stats.people.flatMap((person) => {
    const npub = toPublicNpub(person.npub, (hex) =>
      nostrAdapter.encodeNpub(hex)
    );
    if (!npub) return [];
    return [
      {
        npub,
        name: person.name,
        picture: `${origin}/api/public/avatar/${npub}`,
      },
    ];
  });
  await setJsonInRedis({
    cache: CACHE_NAME,
    key: CACHE_KEY,
    value: stats,
    ttlSeconds: CACHE_TTL_SECONDS,
  });
  try {
    await saveStatsSnapshot(stats);
  } catch (error) {
    logWarning("Public stats snapshot was not stored", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return stats;
}

export async function bustPublicStatsCache(): Promise<void> {
  await deleteFromRedis({ cache: CACHE_NAME, key: CACHE_KEY });
}
