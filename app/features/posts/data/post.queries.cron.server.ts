/**
 * Post Model - Cron / Scheduler Query Operations
 *
 * Read-only queries used by cron/scheduler jobs (e.g. due scheduled posts).
 */

import type { Post } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export function getCronDueScheduledPosts(): Promise<Post[]> {
  const now = new Date();
  return prisma.post.findMany({
    where: {
      // Use currentState as single source of truth
      currentState: "SCHEDULED",
      queueHoldStatus: "NONE",
      scheduledAtUtc: {
        lte: now,
      },
      OR: [{ queueTypeId: null }, { queueType: { status: { not: "PAUSED" } } }],
    },
  });
}
