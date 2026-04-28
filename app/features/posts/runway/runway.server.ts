/**
 * Runway KPI computation from user settings (which queues count, last-post vs first-queue-empty).
 */

import { isQueueSchedulable } from "~/features/posts/queue-status";
import {
  getLatestScheduledLongFormAtUtc,
  getLatestScheduledAtUtc,
} from "~/features/posts/server";
import { getQueueTypesCached } from "~/features/user/services/user-cache.server";
import {
  getRunwaySettings,
  type RunwaySettings,
} from "~/features/user/services/user-settings.server";

/**
 * Returns the latest scheduled date (ms) used for the Runway KPI based on user settings.
 * - If settings not passed, loads via getRunwaySettings(userId).
 * - queueNames empty = use all enabled queue names.
 * - last-post: max of (per-queue latest scheduled) across selected queues.
 * - first-queue-empty: min of (per-queue latest scheduled); if any queue has no future scheduled, returns null.
 */
export async function getRunwayLastScheduledAtUtcMs(
  userId: string,
  now: Date,
  settings?: RunwaySettings | null
): Promise<number | null> {
  const resolved = settings ?? (await getRunwaySettings(userId));

  const queueTypes = await getQueueTypesCached(userId);
  const enabledNames = queueTypes
    .filter((qt) => isQueueSchedulable(qt))
    .map((qt) => qt.name);

  const queueNames =
    resolved.queueNames.length > 0
      ? resolved.queueNames.filter((name) => enabledNames.includes(name))
      : enabledNames;

  if (queueNames.length === 0) {
    return null;
  }

  const perQueueMs: Array<number | null> = await Promise.all(
    queueNames.map(async (queueName) => {
      const [postDate, longFormDate] = await Promise.all([
        getLatestScheduledAtUtc({ userId, queueType: queueName, now }),
        getLatestScheduledLongFormAtUtc({ userId, queueType: queueName, now }),
      ]);
      const postMs = postDate?.getTime() ?? 0;
      const longFormMs = longFormDate?.getTime() ?? 0;
      const max = Math.max(postMs, longFormMs);
      return max > 0 ? max : null;
    })
  );

  if (resolved.mode === "first-queue-empty") {
    const withNull = perQueueMs.includes(null);
    if (withNull) return null;
    return Math.min(...(perQueueMs as number[]));
  }

  const valid = perQueueMs.filter((ms): ms is number => ms !== null);
  if (valid.length === 0) return null;
  return Math.max(...valid);
}
