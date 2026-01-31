/**
 * Content statistics (posts + longform) for dashboard
 */

import { getLongFormStatistics } from "~/models/longformpost.server";
import { getPostStatistics } from "~/models/post.queries.server";

export interface ContentStatistics {
  scheduledCount: number;
  successCount: number;
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
