import { createNostrMashAnalyticsClient } from "~/features/nostrmash/api.server";
import { isSubscriptionActiveForGating } from "~/features/payments/subscriptions.server";
import { env } from "~/lib/env.server";
import { logWarning } from "~/lib/error-logger.server";

import {
  createAnalyticsDirectory,
  listTrackedAuthorEvents,
} from "./data/post-analytics-store.server";
import {
  collectUserPostAnalytics,
  runPostAnalyticsSweep,
  type SweepResult,
} from "./sweep";

function intEnv(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

export function postAnalyticsBatchSize(): number {
  return intEnv(env.POST_ANALYTICS_BATCH_SIZE, 40, 1, 500);
}

export function postAnalyticsConcurrency(): number {
  return intEnv(env.POST_ANALYTICS_CONCURRENCY, 4, 1, 8);
}

const VIEWER_SNAPSHOT_LIMIT = 8;

/**
 * When a paid profile opens an empty catalog, index one NostrMash page now.
 * The background sweep still walks the rest of the history.
 */
export async function collectViewerPostAnalytics(
  userId: string
): Promise<boolean> {
  try {
    if (!(await isSubscriptionActiveForGating(userId))) return false;
    const directory = createAnalyticsDirectory(isSubscriptionActiveForGating);
    const existing = await listTrackedAuthorEvents(userId);
    if (existing.length > 0) return false;
    const result = await collectUserPostAnalytics(
      createNostrMashAnalyticsClient(),
      directory,
      userId,
      {
        snapshotLimit: VIEWER_SNAPSHOT_LIMIT,
        concurrency: postAnalyticsConcurrency(),
        stream: "notes",
      }
    );
    return result.unavailable;
  } catch (error) {
    logWarning("Viewer post analytics collection failed", {
      error: error instanceof Error ? error.message : String(error),
      userId,
    });
    return true;
  }
}

export async function runPaidPostAnalyticsSweep(): Promise<SweepResult> {
  try {
    return await runPostAnalyticsSweep(
      createNostrMashAnalyticsClient(),
      createAnalyticsDirectory(isSubscriptionActiveForGating),
      {
        batchSize: postAnalyticsBatchSize(),
        concurrency: postAnalyticsConcurrency(),
      }
    );
  } catch (error) {
    logWarning("Post analytics sweep failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
