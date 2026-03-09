/**
 * Outbox lock: acquire, heartbeat (extend TTL), and finalize (success / failed / dead-letter).
 * Used by the outbox worker to process events under a single-owner lock.
 */

import {
  claimOutboxEvent,
  extendOutboxEventLock,
  markOutboxEventSucceeded,
  markOutboxEventFailed,
  deadLetterOutboxEvent,
} from "./outbox.server";

export const OUTBOX_LOCK_TTL_MS = 30_000;
export const OUTBOX_LOCK_HEARTBEAT_MS = Math.max(
  1_000,
  Math.floor(OUTBOX_LOCK_TTL_MS / 3)
);

export interface OutboxLock {
  lockId: string;
}

/**
 * Acquire a lock on an outbox event. Returns null if already claimed or not eligible.
 */
export async function acquireOutboxLock(params: {
  eventId: string;
  now: Date;
}): Promise<OutboxLock | null> {
  return await claimOutboxEvent({
    eventId: params.eventId,
    ttlMs: OUTBOX_LOCK_TTL_MS,
    now: params.now,
  });
}

/**
 * Start a heartbeat that extends the lock TTL periodically. Returns a function to stop it.
 */
export function startOutboxLockHeartbeat(params: {
  eventId: string;
  lockId: string;
  onRefreshFailed?: () => void;
}): () => void {
  const interval = setInterval(() => {
    void (async () => {
      const refreshed = await extendOutboxEventLock({
        eventId: params.eventId,
        lockId: params.lockId,
        ttlMs: OUTBOX_LOCK_TTL_MS,
        now: new Date(),
      });
      if (!refreshed && params.onRefreshFailed) {
        params.onRefreshFailed();
      }
    })();
  }, OUTBOX_LOCK_HEARTBEAT_MS);
  return () => clearInterval(interval);
}

/**
 * Finalize successful processing: mark event as succeeded.
 */
export async function finalizeOutboxSuccess(params: {
  eventId: string;
  lockId: string;
  now: Date;
}): Promise<boolean> {
  return markOutboxEventSucceeded({
    eventId: params.eventId,
    lockId: params.lockId,
    now: params.now,
  });
}

/**
 * Finalize for retry: mark event as failed with next attempt time.
 */
export async function finalizeOutboxFailed(params: {
  eventId: string;
  lockId: string;
  errorMessage: string;
  nextAttemptAt: Date;
}): Promise<boolean> {
  return markOutboxEventFailed({
    eventId: params.eventId,
    lockId: params.lockId,
    errorMessage: params.errorMessage,
    nextAttemptAt: params.nextAttemptAt,
  });
}

/**
 * Finalize by moving event to dead-letter queue.
 */
export async function finalizeOutboxDeadLetter(params: {
  eventId: string;
  lockId: string;
  errorMessage: string;
}): Promise<boolean> {
  return deadLetterOutboxEvent({
    eventId: params.eventId,
    lockId: params.lockId,
    errorMessage: params.errorMessage,
  });
}
