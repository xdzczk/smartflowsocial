/**
 * Content statistics (posts + longform) for dashboard
 */

import { shouldShowQueueInUi } from "~/features/posts/queue-status";
import {
  getLongFormStatistics,
  getScheduledLongFormCountByQueue,
  getPostStatistics,
  getScheduledPostsCountByQueue,
} from "~/features/posts/server";
import { getQueueTypesCached } from "~/features/user/services/user-cache.server";

import { countDraftItemsForUser } from "../repositories/entitlement-counts.server";

export interface ContentStatistics {
  scheduledCount: number;
  successCount: number;
}

export interface QueueCountItem {
  queueName: string;
  count: number;
}

export interface DashboardActivitySummary {
  draftCount: number;
  hasDrafts: boolean;
  hasScheduled: boolean;
  hasPublished: boolean;
  hasQueuesWithContent: boolean;
  isFirstRunDashboard: boolean;
}

export async function getContentStatistics(
  userId: string
): Promise<ContentStatistics> {
  const [postStats, longformStats] = await Promise.all([
    getPostStatistics({ userId }),
    getLongFormStatistics({ userId }),
  ]);
  return {
    scheduledCount: postStats.scheduledCount + longformStats.scheduledCount,
    successCount: postStats.successCount + longformStats.successCount,
  };
}

export async function getDraftCountForDashboard(
  userId: string
): Promise<number> {
  return countDraftItemsForUser(userId);
}

export function deriveDashboardActivitySummary({
  draftCount,
  postStatistics,
  queueCountsByQueue,
}: {
  draftCount: number;
  postStatistics: ContentStatistics;
  queueCountsByQueue: QueueCountItem[];
}): DashboardActivitySummary {
  const hasDrafts = draftCount > 0;
  const hasScheduled = postStatistics.scheduledCount > 0;
  const hasPublished = postStatistics.successCount > 0;
  const hasQueuesWithContent = queueCountsByQueue.some(
    (queue) => queue.count > 0
  );
  const isFirstRunDashboard = !(
    hasDrafts ||
    hasScheduled ||
    hasPublished ||
    hasQueuesWithContent
  );

  return {
    draftCount,
    hasDrafts,
    hasScheduled,
    hasPublished,
    hasQueuesWithContent,
    isFirstRunDashboard,
  };
}

export async function getQueueCountsForDashboard(
  userId: string
): Promise<QueueCountItem[]> {
  const [queueTypes, postCounts, longformCounts] = await Promise.all([
    getQueueTypesCached(userId),
    getScheduledPostsCountByQueue({ userId }),
    getScheduledLongFormCountByQueue({ userId }),
  ]);

  const idToName = new Map<string, string>();
  for (const qt of queueTypes) {
    if (shouldShowQueueInUi(qt)) {
      idToName.set(qt.id, qt.name);
    }
  }

  const countByQueueId = new Map<string, number>();

  for (const row of postCounts) {
    const key = row.queueTypeId ?? "__unassigned__";
    countByQueueId.set(key, (countByQueueId.get(key) ?? 0) + row.count);
  }
  for (const row of longformCounts) {
    const key = row.queueTypeId ?? "__unassigned__";
    countByQueueId.set(key, (countByQueueId.get(key) ?? 0) + row.count);
  }

  const result: QueueCountItem[] = [];
  for (const qt of queueTypes) {
    if (!shouldShowQueueInUi(qt)) continue;
    const count = countByQueueId.get(qt.id) ?? 0;
    result.push({ queueName: qt.name, count });
  }
  const unassignedCount = countByQueueId.get("__unassigned__") ?? 0;
  if (unassignedCount > 0) {
    result.push({ queueName: "Unassigned", count: unassignedCount });
  }
  return result;
}
