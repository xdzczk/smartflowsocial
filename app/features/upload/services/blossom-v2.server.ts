import { createHmac, randomUUID } from "node:crypto";

import { getUserById } from "~/features/user";
import { env } from "~/lib/env.server";
import { prisma } from "~/lib/prisma.server";
import { getUserSubscription } from "~/models/payment.server";

const DEFAULT_BLOSSOM_UPLOAD_URL =
  "https://blossom-api.smartflow.social/upload";
const TOKEN_TTL_SECONDS = 180;
const BATCH_TTL_SECONDS = 900;
const MAX_BATCH_SIZE = 500;

type PlanId = "free" | "basic" | "premium" | "pro" | "enterprise";

interface PlanQuotaPolicy {
  monthlyStorageBytes: bigint | null;
  monthlyUploadBytes: bigint | null;
  maxFileBytes: number;
  maxParallelUploadsHint: number;
}

const DEFAULT_PLAN_POLICIES: Record<PlanId, PlanQuotaPolicy> = {
  free: {
    monthlyStorageBytes: BigInt(2 * 1024 * 1024 * 1024),
    monthlyUploadBytes: BigInt(5 * 1024 * 1024 * 1024),
    maxFileBytes: 100 * 1024 * 1024,
    maxParallelUploadsHint: 4,
  },
  basic: {
    monthlyStorageBytes: BigInt(20 * 1024 * 1024 * 1024),
    monthlyUploadBytes: BigInt(100 * 1024 * 1024 * 1024),
    maxFileBytes: 250 * 1024 * 1024,
    maxParallelUploadsHint: 6,
  },
  premium: {
    monthlyStorageBytes: BigInt(100 * 1024 * 1024 * 1024),
    monthlyUploadBytes: BigInt(500 * 1024 * 1024 * 1024),
    maxFileBytes: 500 * 1024 * 1024,
    maxParallelUploadsHint: 8,
  },
  pro: {
    monthlyStorageBytes: BigInt(500 * 1024 * 1024 * 1024),
    monthlyUploadBytes: BigInt(2 * 1024 * 1024 * 1024 * 1024),
    maxFileBytes: 1024 * 1024 * 1024,
    maxParallelUploadsHint: 10,
  },
  enterprise: {
    monthlyStorageBytes: null,
    monthlyUploadBytes: null,
    maxFileBytes: 1024 * 1024 * 1024,
    maxParallelUploadsHint: 10,
  },
};

interface UploadFileIntent {
  sha256: string;
  size: number;
  type: string;
  filename?: string;
}

interface TokenResult {
  sha256: string;
  size: number;
  token?: string;
  expiresIn?: number;
  error?: string;
}

export interface BulkTokenIssueResult {
  uploadUrl: string;
  batchId: string;
  expiresIn: number;
  maxParallelUploadsHint: number;
  results: TokenResult[];
}

interface TokenPayload {
  sub: string;
  sha256: string;
  size: number;
  type: string;
  iat: number;
  exp: number;
  jti: string;
  batchId: string;
  rateClass?: string;
}

export interface CommitItem {
  jti: string;
  pubkey: string;
  sha256: string;
  size: number;
  type?: string;
  url: string;
}

export interface CommitBatchResult {
  processed: number;
  duplicate: number;
  failed: number;
  statuses: Array<{
    jti: string;
    status: "processed" | "duplicate" | "failed";
    reason?: string;
  }>;
}

function getTokenSecret(): string {
  const secret =
    env.BLOSSOM_UPLOAD_TOKEN_SECRET?.trim() ??
    env.BLOSSOM_INTERNAL_SECRET?.trim() ??
    "";
  if (!secret) {
    throw new Error(
      "BLOSSOM_UPLOAD_TOKEN_SECRET (or BLOSSOM_INTERNAL_SECRET fallback) is required"
    );
  }
  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signHs256(payload: TokenPayload, secret: string): string {
  const header = { alg: "HS256", typ: "JWT", kid: "v1" };
  const encodedHeader = encodeBase64Url(JSON.stringify(header));
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const content = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", secret)
    .update(content)
    .digest("base64");
  const encodedSignature = signature
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `${content}.${encodedSignature}`;
}

function parsePlanId(rawPlanId: string | null | undefined): PlanId {
  const planId = (rawPlanId ?? "").toLowerCase();
  if (planId === "basic") return "basic";
  if (planId === "premium") return "premium";
  if (planId === "pro") return "pro";
  if (planId === "enterprise") return "enterprise";
  return "free";
}

function parseOptionalBigInt(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  return null;
}

function parseOptionalInt(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return fallback;
}

function resolveQuotaPolicy(
  planId: PlanId,
  features: unknown
): PlanQuotaPolicy {
  const defaults = DEFAULT_PLAN_POLICIES[planId];
  if (!features || typeof features !== "object") {
    return defaults;
  }
  const featureObj = features as Record<string, unknown>;
  const monthlyStorageBytes =
    parseOptionalBigInt(featureObj["monthly_storage_bytes"]) ??
    parseOptionalBigInt(featureObj["monthlyStorageBytes"]) ??
    defaults.monthlyStorageBytes;
  const monthlyUploadBytes =
    parseOptionalBigInt(featureObj["monthly_upload_bytes"]) ??
    parseOptionalBigInt(featureObj["monthlyUploadBytes"]) ??
    defaults.monthlyUploadBytes;
  const maxFileBytes = parseOptionalInt(
    featureObj["max_file_bytes"] ?? featureObj["maxFileBytes"],
    defaults.maxFileBytes
  );
  const maxParallelUploadsHint = parseOptionalInt(
    featureObj["max_parallel_uploads_hint"] ??
      featureObj["maxParallelUploadsHint"],
    defaults.maxParallelUploadsHint
  );
  return {
    monthlyStorageBytes,
    monthlyUploadBytes,
    maxFileBytes,
    maxParallelUploadsHint,
  };
}

function getMonthStartUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

export async function issueBlossomBulkTokens(
  userId: string,
  files: UploadFileIntent[]
): Promise<BulkTokenIssueResult> {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files array is required");
  }
  if (files.length > MAX_BATCH_SIZE) {
    throw new Error(`batch size exceeds max of ${MAX_BATCH_SIZE}`);
  }

  const user = await getUserById(userId);
  if (!user?.npub) {
    throw new Error("User not found for blossom token issuance");
  }
  const pubkey = user.npub.toLowerCase();
  const subscription = await getUserSubscription(userId);
  const planId = parsePlanId(subscription?.planId);
  const policy = resolveQuotaPolicy(planId, subscription?.Plan?.features);
  const now = Math.floor(Date.now() / 1000);
  const tokenSecret = getTokenSecret();

  const validationResults: TokenResult[] = files.map((f) => {
    if (!isSha256Hex(f.sha256)) {
      return { sha256: f.sha256, size: f.size, error: "invalid_request" };
    }
    if (!Number.isFinite(f.size) || f.size <= 0) {
      return { sha256: f.sha256, size: f.size, error: "invalid_request" };
    }
    if (!f.type || typeof f.type !== "string") {
      return { sha256: f.sha256, size: f.size, error: "invalid_request" };
    }
    if (f.size > policy.maxFileBytes) {
      return { sha256: f.sha256, size: f.size, error: "payload_too_large" };
    }
    return { sha256: f.sha256, size: f.size };
  });

  const validCandidates = files
    .map((file, index) => ({
      file,
      index,
      validation: validationResults[index] ?? {
        sha256: file.sha256,
        size: file.size,
        error: "invalid_request",
      },
    }))
    .filter((entry) => !entry.validation.error)
    .sort((a, b) => a.file.size - b.file.size);

  const [storedAgg, reservedAgg, usage] = await Promise.all([
    prisma.media.aggregate({
      where: {
        userId,
        provider: { startsWith: "BLOSSOM" },
      },
      _sum: { size: true },
    }),
    prisma.blossomReservationItem.aggregate({
      where: {
        pubkey,
        status: "RESERVED",
        expiresAt: { gt: new Date() },
      },
      _sum: { size: true },
    }),
    prisma.blossomUploadUsagePeriod.findUnique({
      where: {
        userId_periodStartUtc: {
          userId,
          periodStartUtc: getMonthStartUtc(),
        },
      },
    }),
  ]);

  let currentStorage =
    BigInt(storedAgg._sum.size ?? 0) + BigInt(reservedAgg._sum.size ?? 0);
  let currentUpload = usage?.uploadedBytes ?? BigInt(0);

  const batchId = randomUUID();
  const batchExpiresAt = new Date((now + BATCH_TTL_SECONDS) * 1000);
  const acceptedForDb: Array<{
    index: number;
    jti: string;
    file: UploadFileIntent;
  }> = [];

  for (const entry of validCandidates) {
    const fileSize = BigInt(entry.file.size);
    const storageAllowed =
      policy.monthlyStorageBytes == null ||
      currentStorage + fileSize <= policy.monthlyStorageBytes;
    const uploadAllowed =
      policy.monthlyUploadBytes == null ||
      currentUpload + fileSize <= policy.monthlyUploadBytes;

    if (!storageAllowed || !uploadAllowed) {
      validationResults[entry.index] = {
        sha256: entry.file.sha256,
        size: entry.file.size,
        error: "quota_exceeded",
      };
      continue;
    }

    currentStorage += fileSize;
    currentUpload += fileSize;
    const jti = randomUUID();
    const payload: TokenPayload = {
      sub: pubkey,
      sha256: entry.file.sha256,
      size: entry.file.size,
      type: entry.file.type,
      iat: now,
      exp: now + TOKEN_TTL_SECONDS,
      jti,
      batchId,
      rateClass: planId,
    };
    validationResults[entry.index] = {
      sha256: entry.file.sha256,
      size: entry.file.size,
      token: signHs256(payload, tokenSecret),
      expiresIn: TOKEN_TTL_SECONDS,
    };
    acceptedForDb.push({
      index: entry.index,
      jti,
      file: entry.file,
    });
  }

  if (acceptedForDb.length > 0) {
    const totalBytes = acceptedForDb.reduce(
      (acc, item) => acc + BigInt(item.file.size),
      BigInt(0)
    );
    await prisma.$transaction([
      prisma.blossomReservationBatch.create({
        data: {
          batchId,
          userId,
          pubkey,
          totalBytes,
          expiresAt: batchExpiresAt,
          status: "ACTIVE",
        },
      }),
      prisma.blossomReservationItem.createMany({
        data: acceptedForDb.map(({ jti, file }) => ({
          jti,
          batchId,
          pubkey,
          sha256: file.sha256,
          size: file.size,
          mimeType: file.type,
          expiresAt: batchExpiresAt,
          status: "RESERVED",
        })),
      }),
    ]);
  }

  return {
    uploadUrl: `${(env.BLOSSOM_SFS_API_URL ?? DEFAULT_BLOSSOM_UPLOAD_URL).replace(/\/$/, "")}/upload`,
    batchId,
    expiresIn: BATCH_TTL_SECONDS,
    maxParallelUploadsHint: policy.maxParallelUploadsHint,
    results: validationResults,
  };
}

function getCommitPeriodDate(): Date {
  return getMonthStartUtc();
}

export async function commitBlossomBatch(
  batchId: string,
  items: CommitItem[]
): Promise<CommitBatchResult> {
  const statuses: CommitBatchResult["statuses"] = [];
  let processed = 0;
  let duplicate = 0;
  let failed = 0;

  for (const item of items) {
    try {
      await prisma.$transaction(async (tx) => {
        const existingCommit = await tx.blossomCommit.findUnique({
          where: { jti: item.jti },
        });
        if (existingCommit) {
          duplicate++;
          statuses.push({ jti: item.jti, status: "duplicate" });
          return;
        }

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
        if (
          reservation.status === "EXPIRED" ||
          reservation.status === "CANCELED"
        ) {
          throw new Error("reservation_inactive");
        }
        if (reservation.pubkey !== item.pubkey) {
          throw new Error("pubkey_mismatch");
        }
        if (
          reservation.sha256 !== item.sha256 ||
          reservation.size !== item.size
        ) {
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

        const periodStartUtc = getCommitPeriodDate();
        await tx.blossomUploadUsagePeriod.upsert({
          where: {
            userId_periodStartUtc: {
              userId: reservation.batch.userId,
              periodStartUtc,
            },
          },
          create: {
            userId: reservation.batch.userId,
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
          where: {
            userId: reservation.batch.userId,
            url: item.url,
          },
        });
        if (!existingMedia) {
          await tx.media.create({
            data: {
              userId: reservation.batch.userId,
              url: item.url,
              sha256: item.sha256,
              size: item.size,
              mimeType: item.type ?? null,
              provider: "BLOSSOM_SFS",
            },
          });
        }
      });
      processed++;
      statuses.push({ jti: item.jti, status: "processed" });
    } catch (error) {
      failed++;
      statuses.push({
        jti: item.jti,
        status: "failed",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { processed, duplicate, failed, statuses };
}

export async function expireBlossomReservations(
  now = new Date()
): Promise<{ itemsExpired: number; batchesExpired: number }> {
  const items = await prisma.blossomReservationItem.updateMany({
    where: {
      status: "RESERVED",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

  const batches = await prisma.blossomReservationBatch.updateMany({
    where: {
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    data: { status: "EXPIRED" },
  });

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

export async function recordBlossomCompatUsage(
  userId: string,
  size: number,
  date = new Date()
): Promise<void> {
  if (!Number.isFinite(size) || size <= 0) return;
  const periodStartUtc = getMonthStartUtc(date);
  await prisma.blossomUploadUsagePeriod.upsert({
    where: {
      userId_periodStartUtc: {
        userId,
        periodStartUtc,
      },
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
