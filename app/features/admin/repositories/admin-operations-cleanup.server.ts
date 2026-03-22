/**
 * Dangerous operator maintenance: BullMQ failed-job cleanup, relay ACK retention purge.
 */

import { cleanupPublishRelayAcks } from "~/features/relays/repositories/publish-relay-ack-retention.server";
import { getQueueInstance } from "~/infra/queue/queue-client.server";
import type { QueueType } from "~/infra/queue/queue-types";
import { logInfo } from "~/lib/error-logger.server";

export const ADMIN_OPERATIONS_QUEUE_NAMES: QueueType[] = [
  "scheduled-posts",
  "scheduled-longform-posts",
  "post-checker",
  "broadcast-dm",
];

const CLEAN_BATCH = 500;
const PER_QUEUE_CAP = 10_000;

async function cleanFailedForQueue(queueName: QueueType): Promise<number> {
  const queue = getQueueInstance(queueName);
  let removed = 0;
  while (removed < PER_QUEUE_CAP) {
    const ids = await queue.clean(0, CLEAN_BATCH, "failed");
    if (ids.length === 0) break;
    removed += ids.length;
  }
  return removed;
}

export async function cleanFailedJobsInAllQueues(args: {
  operatorNpub: string;
}): Promise<
  | { ok: true; total: number; byQueue: Record<string, number> }
  | { ok: false; error: string }
> {
  try {
    const byQueue: Record<string, number> = {};
    let total = 0;
    for (const q of ADMIN_OPERATIONS_QUEUE_NAMES) {
      const n = await cleanFailedForQueue(q);
      byQueue[q] = n;
      total += n;
    }
    logInfo("Admin cleaned failed BullMQ jobs", {
      operatorNpub: args.operatorNpub,
      byQueue,
      total,
    });
    return { ok: true, total, byQueue };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to clean failed jobs",
    };
  }
}

export async function purgePublishRelayAcksAdmin(input: {
  olderThanDays: number;
  operatorNpub: string;
}): Promise<
  | {
      ok: true;
      deletedCount: number;
      cutoffIso: string;
      olderThanDays: number;
    }
  | { ok: false; error: string }
> {
  const days = Math.min(365, Math.max(7, Math.floor(input.olderThanDays)));
  try {
    const result = await cleanupPublishRelayAcks({ olderThanDays: days });
    logInfo("Admin purged old PublishRelayAck rows", {
      operatorNpub: input.operatorNpub,
      deletedCount: result.deletedCount,
      cutoffIso: result.cutoffIso,
      olderThanDays: days,
    });
    return {
      ok: true,
      deletedCount: result.deletedCount,
      cutoffIso: result.cutoffIso,
      olderThanDays: days,
    };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : "Failed to purge relay acknowledgements",
    };
  }
}
