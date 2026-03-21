/**
 * Best-effort system health probes for admin (DB, Redis queues, outbox, relay ratio).
 */

import { getOutboxBacklogCounts } from "~/infra/outbox/outbox.server";
import { getQueueInstance } from "~/infra/queue/queue-client.server";
import type { QueueType } from "~/infra/queue/queue-types";
import { prisma } from "~/lib/prisma.server";

import type { DateRangeBounds } from "../metrics/date-range";

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
];

export async function getAdminQueueHealthSnapshot(
  _bounds: DateRangeBounds,
  relay: { relayAccepted: number; relayFailed: number }
): Promise<HealthRow[]> {
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

  const rTotal = relay.relayAccepted + relay.relayFailed;
  if (rTotal === 0) {
    rows.push({
      id: "relay",
      label: "Relay publish (range)",
      status: "unknown",
      detail: "No relay ACK rows in selected range",
    });
  } else {
    const rate = relay.relayAccepted / rTotal;
    rows.push({
      id: "relay",
      label: "Relay publish (range)",
      status: rate >= 0.85 ? "healthy" : rate >= 0.7 ? "degraded" : "failing",
      detail: `${Math.round(rate * 100)}% accepted (${relay.relayAccepted}/${rTotal})`,
    });
  }

  rows.push({
    id: "worker",
    label: "Workers",
    status: redisOk ? "unknown" : "unknown",
    detail: redisOk
      ? "Use queue depth + metrics; no separate heartbeat yet"
      : "Unavailable",
  });

  return rows;
}
