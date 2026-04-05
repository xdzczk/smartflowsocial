/**
 * Blossom reservation and usage period data. All prisma usage for blossom-v2 confined here.
 */

import { prisma } from "~/lib/prisma.server";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function aggregateReservedSizeForPubkey(pubkey: string) {
  return prisma.blossomReservationItem.aggregate({
    where: {
      pubkey,
      status: "RESERVED",
      expiresAt: { gt: new Date() },
    },
    _sum: { size: true },
  });
}

export async function findBlossomUsagePeriod(
  userId: string,
  periodStartUtc: Date
) {
  return prisma.blossomUploadUsagePeriod.findUnique({
    where: {
      userId_periodStartUtc: { userId, periodStartUtc },
    },
  });
}

export interface CommitBlossomBatchResult {
  processed: number;
  duplicate: number;
  failed: number;
  statuses: Array<{
    jti: string;
    status: "processed" | "duplicate" | "failed";
    reason?: string;
  }>;
}

export async function commitBlossomBatch(
  items: Array<{
    jti: string;
    pubkey: string;
    sha256: string;
    size: number;
    type?: string;
    url: string;
  }>,
  batchId: string,
  periodStartUtc: Date
): Promise<CommitBlossomBatchResult> {
  const statuses: CommitBlossomBatchResult["statuses"] = [];
  let processed = 0;
  let duplicate = 0;
  let failed = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      try {
        const result = await runCommitBlossomItemInTransaction(
          tx,
          item,
          batchId,
          periodStartUtc
        );
        if (result === "duplicate") {
          duplicate++;
          statuses.push({ jti: item.jti, status: "duplicate" });
        } else {
          processed++;
          statuses.push({ jti: item.jti, status: "processed" });
        }
      } catch (error) {
        failed++;
        statuses.push({
          jti: item.jti,
          status: "failed",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  });

  return { processed, duplicate, failed, statuses };
}

export async function createBlossomReservationBatchAndItems(
  batchId: string,
  userId: string,
  pubkey: string,
  provider:
    | "S3"
    | "BLOSSOM_PRIMAL"
    | "BLOSSOM_BLOSSTR"
    | "BLOSSOM_SFS"
    | "BLOSSOM_CUSTOM",
  sourceIntentId: string | null,
  totalBytes: bigint,
  expiresAt: Date,
  items: Array<{ jti: string; sha256: string; size: number; mimeType: string }>
) {
  await prisma.$transaction([
    prisma.blossomReservationBatch.create({
      data: {
        batchId,
        userId,
        pubkey,
        provider,
        sourceIntentId,
        totalBytes,
        expiresAt,
        status: "ACTIVE",
      },
    }),
    prisma.blossomReservationItem.createMany({
      data: items.map((item) => ({
        jti: item.jti,
        batchId,
        pubkey,
        sha256: item.sha256,
        size: item.size,
        mimeType: item.mimeType,
        expiresAt,
        status: "RESERVED",
      })),
    }),
  ]);
}

export async function runCommitBlossomItemInTransaction(
  tx: Tx,
  item: {
    jti: string;
    pubkey: string;
    sha256: string;
    size: number;
    type?: string;
    url: string;
  },
  batchId: string,
  periodStartUtc: Date
): Promise<"duplicate" | void> {
  const existingCommit = await tx.blossomCommit.findUnique({
    where: { jti: item.jti },
  });
  if (existingCommit) return "duplicate";

  const reservation = await tx.blossomReservationItem.findUnique({
    where: { jti: item.jti },
    include: { batch: true },
  });
  if (!reservation) {
    throw new Error("reservation_not_found");
  }
  if (
    reservation.batchId !== batchId ||
    reservation.batch.batchId !== batchId
  ) {
    throw new Error("batch_mismatch");
  }
  if (reservation.status === "EXPIRED" || reservation.status === "CANCELED") {
    throw new Error("reservation_inactive");
  }
  if (reservation.pubkey !== item.pubkey) {
    throw new Error("pubkey_mismatch");
  }
  if (reservation.sha256 !== item.sha256 || reservation.size !== item.size) {
    throw new Error("payload_mismatch");
  }

  await tx.blossomCommit.create({
    data: {
      jti: item.jti,
      batchId,
      pubkey: item.pubkey,
      sha256: item.sha256,
      size: item.size,
      mimeType: item.type ?? null,
      url: item.url,
    },
  });

  await tx.blossomReservationItem.update({
    where: { jti: item.jti },
    data: { status: "COMMITTED" },
  });

  const userId = reservation.batch.userId;
  await tx.blossomUploadUsagePeriod.upsert({
    where: {
      userId_periodStartUtc: { userId, periodStartUtc },
    },
    create: {
      userId,
      periodStartUtc,
      uploadedBytes: BigInt(item.size),
      uploadedFiles: 1,
    },
    update: {
      uploadedBytes: { increment: BigInt(item.size) },
      uploadedFiles: { increment: 1 },
    },
  });

  const existingMedia = await tx.media.findFirst({
    where: { userId, url: item.url },
  });
  if (!existingMedia) {
    await tx.media.create({
      data: {
        userId,
        url: item.url,
        sha256: item.sha256,
        size: item.size,
        mimeType: item.type ?? null,
        provider: reservation.batch.provider,
      },
    });
  }
}

export async function expireBlossomReservations(now: Date) {
  const [items, batches] = await Promise.all([
    prisma.blossomReservationItem.updateMany({
      where: { status: "RESERVED", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    }),
    prisma.blossomReservationBatch.updateMany({
      where: { status: "ACTIVE", expiresAt: { lt: now } },
      data: { status: "EXPIRED" },
    }),
  ]);
  return { itemsExpired: items.count, batchesExpired: batches.count };
}

export async function getActiveReservedBytesForPubkey(
  pubkey: string
): Promise<bigint> {
  const aggregate = await prisma.blossomReservationItem.aggregate({
    where: {
      pubkey,
      status: "RESERVED",
      expiresAt: { gt: new Date() },
    },
    _sum: { size: true },
  });
  return BigInt(aggregate._sum.size ?? 0);
}

export async function getBlossomReservationDriftStats() {
  const now = new Date();
  const [reservedCount, activeBatchCount, oldestReserved] = await Promise.all([
    prisma.blossomReservationItem.count({
      where: { status: "RESERVED", expiresAt: { gt: now } },
    }),
    prisma.blossomReservationBatch.count({
      where: { status: "ACTIVE", expiresAt: { gt: now } },
    }),
    prisma.blossomReservationItem.findFirst({
      where: { status: "RESERVED", expiresAt: { gt: now } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
  ]);
  return {
    reservedCount,
    activeBatchCount,
    oldestReservedCreatedAt: oldestReserved?.createdAt ?? null,
  };
}

export async function upsertBlossomUsagePeriod(
  userId: string,
  periodStartUtc: Date,
  size: number
) {
  if (!Number.isFinite(size) || size <= 0) return;
  await prisma.blossomUploadUsagePeriod.upsert({
    where: {
      userId_periodStartUtc: { userId, periodStartUtc },
    },
    create: {
      userId,
      periodStartUtc,
      uploadedBytes: BigInt(Math.trunc(size)),
      uploadedFiles: 1,
    },
    update: {
      uploadedBytes: { increment: BigInt(Math.trunc(size)) },
      uploadedFiles: { increment: 1 },
    },
  });
}
