/**
 * Product session + signer reconnect telemetry (authenticated user APIs).
 */

import {
  type ProductSessionDeviceCoarse,
  SignerReconnectFailureBucket,
} from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

const HEARTBEAT_MIN_MS = 45_000;
const SIGNER_RECONNECT_MAX_PER_HOUR = 120;

export async function upsertProductSessionStart(input: {
  userId: string;
  clientSessionId: string;
  deviceCoarse?: ProductSessionDeviceCoarse | null;
}): Promise<void> {
  const { userId, clientSessionId, deviceCoarse } = input;
  const now = new Date();
  await prisma.productSession.upsert({
    where: {
      userId_clientSessionId: { userId, clientSessionId },
    },
    create: {
      userId,
      clientSessionId,
      startedAt: now,
      lastActivityAt: now,
      deviceCoarse: deviceCoarse ?? undefined,
    },
    update: {
      lastActivityAt: now,
      endedAt: null,
      ...(deviceCoarse ? { deviceCoarse } : {}),
    },
  });
}

export async function touchProductSessionHeartbeat(input: {
  userId: string;
  clientSessionId: string;
}): Promise<{ ok: boolean; reason?: "throttled" }> {
  const row = await prisma.productSession.findUnique({
    where: {
      userId_clientSessionId: {
        userId: input.userId,
        clientSessionId: input.clientSessionId,
      },
    },
    select: { lastActivityAt: true, endedAt: true },
  });
  if (!row || row.endedAt) {
    await upsertProductSessionStart({
      userId: input.userId,
      clientSessionId: input.clientSessionId,
    });
    return { ok: true };
  }
  const elapsed = Date.now() - row.lastActivityAt.getTime();
  if (elapsed < HEARTBEAT_MIN_MS) {
    return { ok: false, reason: "throttled" };
  }
  await prisma.productSession.update({
    where: {
      userId_clientSessionId: {
        userId: input.userId,
        clientSessionId: input.clientSessionId,
      },
    },
    data: { lastActivityAt: new Date() },
  });
  return { ok: true };
}

export async function endProductSession(input: {
  userId: string;
  clientSessionId: string;
}): Promise<void> {
  await prisma.productSession.updateMany({
    where: {
      userId: input.userId,
      clientSessionId: input.clientSessionId,
      endedAt: null,
    },
    data: { endedAt: new Date() },
  });
}

export async function signerReconnectRecentCount(
  userId: string,
  since: Date
): Promise<number> {
  return prisma.signerReconnectEvent.count({
    where: { userId, createdAt: { gte: since } },
  });
}

export async function insertSignerReconnectEvent(input: {
  userId: string;
  success: boolean;
  failureBucket?: SignerReconnectFailureBucket | null;
}): Promise<{ ok: true } | { ok: false; reason: "rate_limited" }> {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const n = await signerReconnectRecentCount(input.userId, since);
  if (n >= SIGNER_RECONNECT_MAX_PER_HOUR) {
    return { ok: false, reason: "rate_limited" };
  }
  await prisma.signerReconnectEvent.create({
    data: {
      userId: input.userId,
      success: input.success,
      failureBucket: input.success
        ? null
        : (input.failureBucket ?? SignerReconnectFailureBucket.UNKNOWN),
    },
  });
  return { ok: true };
}
