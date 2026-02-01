/**
 * Content statistics (posts + longform) for dashboard
 */

import { getQueueTypesCached } from "~/features/user/services/user-cache.server";
import {
  getLongFormStatistics,
  getScheduledLongFormCountByQueue,
} from "~/models/longformpost.server";
import {
  getPostStatistics,
  getScheduledPostsCountByQueue,
} from "~/models/post.queries.server";

export interface ContentStatistics {
  scheduledCount: number;
  successCount: number;
}

export interface QueueCountItem {
  queueName: string;
  count: number;
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
    if (qt.isEnabled !== false) {
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
    if (qt.isEnabled === false) continue;
    const count = countByQueueId.get(qt.id) ?? 0;
    result.push({ queueName: qt.name, count });
  }
  const unassignedCount = countByQueueId.get("__unassigned__") ?? 0;
  if (unassignedCount > 0) {
    result.push({ queueName: "Unassigned", count: unassignedCount });
  }
  return result;
}
