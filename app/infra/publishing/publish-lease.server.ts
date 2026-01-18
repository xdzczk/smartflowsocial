import { randomUUID } from "node:crypto";

import { prisma } from "~/lib/prisma.server";

export interface PublishLease {
  lockId: string;
  expiresAt: Date;
}

export const DEFAULT_PUBLISH_LEASE_TTL_MS = 30_000;

function computeExpiresAt(now: Date, ttlMs: number): Date {
  return new Date(now.getTime() + ttlMs);
}

/**
 * Acquire a DB-backed publish lease for a Post.
 *
 * This is a best-effort mechanism to prevent two workers from publishing the same
 * post concurrently when you move to multi-worker deployments.
 *
 * It is intentionally designed to be safe under retries:
 * - If the worker crashes, the lease expires and a retry can proceed.
 * - If another worker is already publishing and the lease hasn't expired, we skip.
 */
export async function acquirePostPublishLease(input: {
  postId: string;
  userId: string;
  ttlMs?: number;
  now?: Date;
}): Promise<PublishLease | null> {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_PUBLISH_LEASE_TTL_MS;
  const lockId = randomUUID();
  const expiresAt = computeExpiresAt(now, ttlMs);

  const updated = await prisma.post.updateMany({
    where: {
      id: input.postId,
      userId: input.userId,
      currentState: { in: ["SCHEDULED", "PUBLISHING"] },
      OR: [
        { publishingLockExpiresAt: null },
        { publishingLockExpiresAt: { lt: now } },
      ],
    },
    data: {
      publishingLockId: lockId,
      publishingLockExpiresAt: expiresAt,
      publishingStartedAt: now,
    },
  });

  if (updated.count !== 1) {
    return null;
  }

  return { lockId, expiresAt };
}

export async function releasePostPublishLease(input: {
  postId: string;
  userId: string;
  lockId: string;
}): Promise<void> {
  await prisma.post.updateMany({
    where: {
      id: input.postId,
      userId: input.userId,
      publishingLockId: input.lockId,
    },
    data: {
      publishingLockId: null,
      publishingLockExpiresAt: null,
    },
  });
}

export async function acquireLongFormPostPublishLease(input: {
  postId: string;
  userId: string;
  ttlMs?: number;
  now?: Date;
}): Promise<PublishLease | null> {
  const now = input.now ?? new Date();
  const ttlMs = input.ttlMs ?? DEFAULT_PUBLISH_LEASE_TTL_MS;
  const lockId = randomUUID();
  const expiresAt = computeExpiresAt(now, ttlMs);

  const updated = await prisma.longFormPost.updateMany({
    where: {
      id: input.postId,
      userId: input.userId,
      currentState: { in: ["SCHEDULED", "PUBLISHING"] },
      OR: [
        { publishingLockExpiresAt: null },
        { publishingLockExpiresAt: { lt: now } },
      ],
    },
    data: {
      publishingLockId: lockId,
      publishingLockExpiresAt: expiresAt,
      publishingStartedAt: now,
    },
  });

  if (updated.count !== 1) {
    return null;
  }

  return { lockId, expiresAt };
}

export async function releaseLongFormPostPublishLease(input: {
  postId: string;
  userId: string;
  lockId: string;
}): Promise<void> {
  await prisma.longFormPost.updateMany({
    where: {
      id: input.postId,
      userId: input.userId,
      publishingLockId: input.lockId,
    },
    data: {
      publishingLockId: null,
      publishingLockExpiresAt: null,
    },
  });
}
