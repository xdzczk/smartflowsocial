/**
 * Best-effort system health probes for admin (DB, Redis queues, outbox, worker heuristic).
 */

import { getOutboxBacklogCounts } from "~/infra/outbox/outbox.server";
import { getQueueInstance } from "~/infra/queue/queue-client.server";
import type { QueueType } from "~/infra/queue/queue-types";
import { prisma } from "~/lib/prisma.server";

export type HealthStatus = "healthy" | "degraded" | "unknown" | "failing";

export interface HealthRow {
  id: string;
  label: string;
  status: HealthStatus;
  detail?: string;
}

const QUEUES: QueueType[] = [
  "scheduled-posts",
  "scheduled-longform-posts",
  "post-checker",
  "broadcast-dm",
];

/** No separate worker heartbeat  -  infer from BullMQ waiting vs active totals. */
function workerHealthFromQueueTotals(
  redisOk: boolean,
  totalWaiting: number,
  totalActive: number
): { status: HealthStatus; detail: string } {
  if (!redisOk) {
    return { status: "unknown", detail: "Redis unreachable" };
  }
  if (totalActive > 0) {
    return {
      status: "healthy",
      detail: `${totalActive} active job(s), ${totalWaiting} waiting (all queues)`,
    };
  }
  if (totalWaiting >= 100) {
    return {
      status: "failing",
      detail: `${totalWaiting} waiting, 0 active  -  likely no consumers`,
    };
  }
  if (totalWaiting >= 25) {
    return {
      status: "degraded",
      detail: `${totalWaiting} waiting, 0 active  -  verify worker processes`,
    };
  }
  if (totalWaiting > 0) {
    return {
      status: "healthy",
      detail: `${totalWaiting} waiting, 0 active (short gap or slow pickup)`,
    };
  }
  return {
    status: "healthy",
    detail: "No backlog; workers idle or polling",
  };
}

export async function getAdminQueueHealthSnapshot(): Promise<HealthRow[]> {
  const rows: HealthRow[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    rows.push({
      id: "db",
      label: "Database",
      status: "healthy",
      detail: "Connected",
    });
  } catch {
    rows.push({
      id: "db",
      label: "Database",
      status: "failing",
      detail: "Ping failed",
    });
  }

  let redisOk = true;
  let queueDetail = "";
  let totalWaiting = 0;
  let totalActive = 0;
  try {
    const parts: string[] = [];
    for (const q of QUEUES) {
      const queue = getQueueInstance(q);
      const c = await queue.getJobCounts(
        "waiting",
        "active",
        "failed",
        "delayed"
      );
      const w = c["waiting"] ?? 0;
      const a = c["active"] ?? 0;
      const f = c["failed"] ?? 0;
      totalWaiting += w;
      totalActive += a;
      parts.push(`${q}: ${w}w/${a}a/${f}f`);
    }
    queueDetail = parts.join(" · ");
    rows.push({
      id: "queues",
      label: "Job queues",
      status: "healthy",
      detail: queueDetail,
    });
  } catch {
    redisOk = false;
    rows.push({
      id: "queues",
      label: "Job queues",
      status: "unknown",
      detail: "Redis unreachable from app server",
    });
  }

  try {
    const ob = await getOutboxBacklogCounts();
    const backlog = ob.pending + ob.ready;
    rows.push({
      id: "outbox",
      label: "Outbox",
      status: ob.deadLettered > 0 ? "degraded" : "healthy",
      detail: `${backlog} pending/ready, ${ob.deadLettered} dead-lettered`,
    });
  } catch {
    rows.push({
      id: "outbox",
      label: "Outbox",
      status: "unknown",
      detail: "Could not load outbox counts",
    });
  }

  const worker = workerHealthFromQueueTotals(
    redisOk,
    totalWaiting,
    totalActive
  );
  rows.push({
    id: "worker",
    label: "Workers",
    status: worker.status,
    detail: worker.detail,
  });

  return rows;
}
