import { createHmac, randomUUID } from "node:crypto";

import { getUserSubscription } from "~/features/payments/data";
import { mapLegacyPlanIdToCommercialPlanType } from "~/features/payments/plan-mapping";
import { getCanonicalPlanPolicy } from "~/features/payments/plan-policy";
import { getUserById } from "~/features/user";
import { loadUploadProviderSettings } from "~/features/user/services/upload-provider.server";
import { BRAND_NAME } from "~/lib/brand";
import { env } from "~/lib/env.server";
import { logInfo, logWarning } from "~/lib/error-logger.server";
import { AuthorizationError } from "~/lib/errors";

import {
  aggregateReservedSizeForPubkey,
  commitBlossomBatch as commitBlossomBatchInRepo,
  createBlossomReservationBatchAndItems,
  expireBlossomReservations as expireBlossomReservationsInRepo,
  findBlossomUsagePeriod,
  getActiveReservedBytesForPubkey as getActiveReservedBytesForPubkeyFromRepo,
  getBlossomReservationDriftStats as getBlossomReservationDriftStatsFromRepo,
  upsertBlossomUsagePeriod,
} from "../repositories/blossom-data.server";
import { findMediaUploadIntentByIntentId } from "../repositories/media-intent-data.server";

import { getCanonicalOwnedBytesForUser } from "./media.server";

const DEFAULT_BLOSSOM_API_URL = "https://blossom-api.smartflow.social";
const TOKEN_TTL_SECONDS = 180;
const BATCH_TTL_SECONDS = 900;
const MAX_BATCH_SIZE = 500;

interface UploadFileIntent {
  sha256: string;
  size: number;
  type: string;
  filename?: string;
}

interface IssueTokenContext {
  intentId: string;
  requestedProvider: string;
  requestId?: string;
}

type UploadProviderName =
  | "S3"
  | "BLOSSOM_PRIMAL"
  | "BLOSSOM_BLOSSTR"
  | "BLOSSOM_SFS"
  | "BLOSSOM_CUSTOM";

interface TokenResult {
  sha256: string;
  size: number;
  token?: string;
  expiresIn?: number;
  error?: string;
  message?: string;
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

function resolveBlossomUploadBaseUrl(): string {
  const configured = env.BLOSSOM_SFS_API_URL?.trim();
  const rawBase =
    configured && configured.length > 0 ? configured : DEFAULT_BLOSSOM_API_URL;
  const trimmed = rawBase.replace(/\/+$/, "");
  // Accept either ".../upload" or API root in env and normalize to API root.
  return trimmed.replace(/\/upload$/i, "");
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

function formatHostedMediaBytes(bytes: number): string {
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes % GB === 0) return `${bytes / GB} GB`;
  if (bytes % MB === 0) return `${bytes / MB} MB`;
  const mb = Math.round((bytes / MB) * 10) / 10;
  return `${mb} MB`;
}

function getMonthStartUtc(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value);
}

function normalizeUploadProvider(
  provider: string | null | undefined
): UploadProviderName | null {
  if (
    provider === "S3" ||
    provider === "BLOSSOM_PRIMAL" ||
    provider === "BLOSSOM_BLOSSTR" ||
    provider === "BLOSSOM_SFS" ||
    provider === "BLOSSOM_CUSTOM"
  ) {
    return provider;
  }
  return null;
}

function throwProviderMismatch(args: {
  userId: string;
  requestId?: string;
  requestedProvider: string;
  resolvedProvider: string;
  intentProvider: string;
  reservationBatchProvider: string | null;
  authorizationProvider: string;
  reason: string;
  intentId: string;
}) {
  logWarning("MEDIA_PROVIDER_MISMATCH", {
    errorCode: "MEDIA_PROVIDER_MISMATCH",
    userId: args.userId,
    requestId: args.requestId ?? undefined,
    intentId: args.intentId,
    requestedProvider: args.requestedProvider,
    resolvedProvider: args.resolvedProvider,
    intentProvider: args.intentProvider,
    reservationBatchProvider: args.reservationBatchProvider,
    authorizationProvider: args.authorizationProvider,
    reason: args.reason,
  });
  throw new Error("MEDIA_PROVIDER_MISMATCH");
}

export async function issueBlossomBulkTokens(
  userId: string,
  files: UploadFileIntent[],
  context: IssueTokenContext
): Promise<BulkTokenIssueResult> {
  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("files array is required");
  }
  if (files.length > MAX_BATCH_SIZE) {
    throw new Error(`batch size exceeds max of ${MAX_BATCH_SIZE}`);
  }
  if (!context.intentId || !context.requestedProvider) {
    throw new Error("media_intent_required");
  }

  const requestedProvider = normalizeUploadProvider(context.requestedProvider);
  if (!requestedProvider) {
    throw new Error("MEDIA_PROVIDER_MISMATCH");
  }

  const [intent, uploadSettings] = await Promise.all([
    findMediaUploadIntentByIntentId(context.intentId),
    loadUploadProviderSettings(userId),
  ]);
  if (intent?.userId !== userId) {
    throw new Error("media_intent_not_found");
  }
  if (intent.expiresAt.getTime() < Date.now()) {
    throw new Error("media_intent_expired");
  }
  const resolvedProvider = normalizeUploadProvider(uploadSettings.provider);
  if (!resolvedProvider) {
    throw new Error("MEDIA_PROVIDER_MISMATCH");
  }
  const intentProvider = normalizeUploadProvider(intent.provider);
  if (!intentProvider) {
    throw new Error("MEDIA_PROVIDER_MISMATCH");
  }
  if (
    requestedProvider !== intentProvider ||
    resolvedProvider !== intentProvider ||
    requestedProvider !== resolvedProvider
  ) {
    throwProviderMismatch({
      userId,
      requestId: context.requestId,
      intentId: context.intentId,
      requestedProvider,
      resolvedProvider,
      intentProvider,
      reservationBatchProvider: null,
      authorizationProvider: "n/a",
      reason: "requested_resolved_intent_mismatch",
    });
  }
  if (intentProvider !== "BLOSSOM_SFS") {
    throwProviderMismatch({
      userId,
      requestId: context.requestId,
      intentId: context.intentId,
      requestedProvider,
      resolvedProvider,
      intentProvider,
      reservationBatchProvider: null,
      authorizationProvider: intentProvider,
      reason: "token_lane_requires_blossom_sfs",
    });
  }

  logInfo("blossom_token_issuance_provider_resolved", {
    userId,
    requestId: context.requestId ?? undefined,
    requestedProvider,
    resolvedProvider,
    intentProvider,
    reservationBatchProvider: null,
    authorizationProvider: intentProvider,
    fallbackUsed: false,
    fallbackReason: null,
    intentId: context.intentId,
  });

  const user = await getUserById(userId);
  if (!user?.npub) {
    throw new Error("User not found for blossom token issuance");
  }
  const pubkey = user.npub.toLowerCase();
  const subscription = await getUserSubscription(userId);
  const commercialPlanType = mapLegacyPlanIdToCommercialPlanType(
    subscription?.planId ?? subscription?.Plan?.id ?? subscription?.Plan?.name
  );
  const canonicalPolicy = getCanonicalPlanPolicy(commercialPlanType);
  if (!canonicalPolicy.media.canUseSfsBlossomStorage) {
    throw new AuthorizationError(
      `${BRAND_NAME}-hosted media is available on Creator and Pro plans.`,
      { commercialPlanType, planId: subscription?.planId ?? null }
    );
  }

  const hostedMediaPolicy = canonicalPolicy.media;
  if (
    hostedMediaPolicy.monthlyStorageBytes == null ||
    hostedMediaPolicy.monthlyUploadBytes == null ||
    hostedMediaPolicy.maxFileBytes == null ||
    hostedMediaPolicy.maxParallelUploadsHint == null
  ) {
    throw new Error(
      `Hosted media policy is missing quota fields for planType=${commercialPlanType}`
    );
  }
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
    if (hostedMediaPolicy.maxFileBytes == null) {
      return { sha256: f.sha256, size: f.size, error: "invalid_request" };
    }
    if (f.size > hostedMediaPolicy.maxFileBytes) {
      return {
        sha256: f.sha256,
        size: f.size,
        error: "payload_too_large",
        message: `This file exceeds your plan’s hosted media size limit (${formatHostedMediaBytes(hostedMediaPolicy.maxFileBytes)}).`,
      };
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

  const periodStartUtc = getMonthStartUtc();
  const [storedOwnedBytes, reservedAgg, usage] = await Promise.all([
    getCanonicalOwnedBytesForUser(userId),
    aggregateReservedSizeForPubkey(pubkey),
    findBlossomUsagePeriod(userId, periodStartUtc),
  ]);

  let currentStorage = storedOwnedBytes + BigInt(reservedAgg._sum.size ?? 0);
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
      currentStorage + fileSize <= hostedMediaPolicy.monthlyStorageBytes;
    const uploadAllowed =
      currentUpload + fileSize <= hostedMediaPolicy.monthlyUploadBytes;

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
      // Used by the Blossom gateway to enforce policy independently.
      // Keep legacy plan ids so the gateway can map: basic→creator, premium→pro, etc.
      rateClass: subscription?.planId ?? commercialPlanType,
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
    await createBlossomReservationBatchAndItems(
      batchId,
      userId,
      pubkey,
      intentProvider,
      context.intentId,
      totalBytes,
      batchExpiresAt,
      acceptedForDb.map(({ jti, file }) => ({
        jti,
        sha256: file.sha256,
        size: file.size,
        mimeType: file.type,
      }))
    );
  }

  logInfo("blossom_token_issuance_completed", {
    userId,
    requestId: context.requestId ?? undefined,
    requestedProvider,
    resolvedProvider,
    intentProvider,
    reservationBatchProvider: intentProvider,
    authorizationProvider: intentProvider,
    fallbackUsed: false,
    fallbackReason: null,
    intentId: context.intentId,
    batchId,
    issuedTokenCount: acceptedForDb.length,
  });

  return {
    uploadUrl: `${resolveBlossomUploadBaseUrl()}/upload`,
    batchId,
    expiresIn: BATCH_TTL_SECONDS,
    maxParallelUploadsHint: hostedMediaPolicy.maxParallelUploadsHint,
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
  const periodStartUtc = getCommitPeriodDate();
  return commitBlossomBatchInRepo(items, batchId, periodStartUtc);
}

export async function expireBlossomReservations(
  now = new Date()
): Promise<{ itemsExpired: number; batchesExpired: number }> {
  return expireBlossomReservationsInRepo(now);
}

export async function getActiveReservedBytesForPubkey(
  pubkey: string
): Promise<bigint> {
  return getActiveReservedBytesForPubkeyFromRepo(pubkey);
}

export async function getBlossomReservationDriftStats(): Promise<{
  reservedCount: number;
  activeBatchCount: number;
  oldestReservedCreatedAt: Date | null;
}> {
  return getBlossomReservationDriftStatsFromRepo();
}

export async function recordBlossomCompatUsage(
  userId: string,
  size: number,
  date = new Date()
): Promise<void> {
  const periodStartUtc = getMonthStartUtc(date);
  await upsertBlossomUsagePeriod(userId, periodStartUtc, size);
}
