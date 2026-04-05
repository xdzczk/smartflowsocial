import { randomUUID } from "node:crypto";

import { loadUploadProviderSettings } from "~/features/user";

import {
  createMediaAsset,
  createMediaVariant,
  findMediaAssetByUserAndSha256,
  findMediaVariantByAssetKindProviderUrl,
  updateMediaAssetStatus,
} from "../repositories/media-data.server";
import {
  createMediaUploadIntent,
  findMediaUploadIntentByIntentId,
} from "../repositories/media-intent-data.server";

import { evaluateMediaPolicy } from "./media-policy.server";
import { enqueueMediaProcessing } from "./media-processing.server";
import { createMediaIfMissing } from "./media.server";

type UploadProviderName =
  | "S3"
  | "BLOSSOM_PRIMAL"
  | "BLOSSOM_BLOSSTR"
  | "BLOSSOM_SFS"
  | "BLOSSOM_CUSTOM";

type IngestLane = "server_upload" | "direct_client_upload";

export interface MediaIntentFile {
  fileName: string;
  size: number;
  mimeType: string;
  sha256?: string;
}

export interface MediaIntentItem {
  intentFileId: string;
  fileName: string;
  size: number;
  mimeType: string;
  sha256?: string;
  lane: IngestLane;
  uploadEndpoint: string;
}

export interface MediaIntentResponse {
  intentId: string;
  provider: UploadProviderName;
  customBlossomUrl: string | null;
  enableMirrorBlossom: boolean;
  mirrorUploadUrls: string[];
  files: MediaIntentItem[];
}

export interface MediaCommitItem {
  fileName: string;
  url: string;
  size: number;
  mimeType: string;
  provider: UploadProviderName;
  sha256?: string;
}

export interface MediaCommitResponse {
  committed: Array<{
    mediaId: string;
    assetId: string;
    status: "uploaded" | "processing" | "ready" | "failed";
    fileName: string;
    url: string;
  }>;
}

const MEDIA_INTENT_TTL_MS = 30 * 60 * 1000;

function normalizeProvider(provider: string): UploadProviderName {
  if (
    provider === "BLOSSOM_PRIMAL" ||
    provider === "BLOSSOM_BLOSSTR" ||
    provider === "BLOSSOM_SFS" ||
    provider === "BLOSSOM_CUSTOM"
  ) {
    return provider;
  }
  return "S3";
}

export async function createMediaIngestIntent(
  userId: string,
  files: MediaIntentFile[],
  options?: { composeSessionId?: string | null }
): Promise<MediaIntentResponse> {
  for (const file of files) {
    const policy = evaluateMediaPolicy({
      mimeType: file.mimeType,
      sizeBytes: file.size,
    });
    if (!policy.allowed) {
      throw new Error(policy.reason ?? "policy_rejected");
    }
  }
  const settings = await loadUploadProviderSettings(userId);
  const provider = normalizeProvider(settings.provider);
  const lane: IngestLane =
    provider === "S3" ? "server_upload" : "direct_client_upload";
  const uploadEndpoint =
    lane === "server_upload" ? "/api/upload" : "/api/upload-blossom";
  const intentId = randomUUID();
  await createMediaUploadIntent({
    intentId,
    userId,
    provider,
    fileCount: files.length,
    composeSessionId: options?.composeSessionId ?? null,
    expiresAt: new Date(Date.now() + MEDIA_INTENT_TTL_MS),
  });

  return {
    intentId,
    provider,
    customBlossomUrl: settings.customBlossomUrl,
    enableMirrorBlossom: settings.enableMirrorBlossom,
    mirrorUploadUrls: settings.mirrorUploadUrls,
    files: files.map((file) => ({
      intentFileId: randomUUID(),
      fileName: file.fileName,
      size: file.size,
      mimeType: file.mimeType,
      sha256: file.sha256,
      lane,
      uploadEndpoint,
    })),
  };
}

export async function commitMediaIngest(
  userId: string,
  items: MediaCommitItem[],
  options?: { intentId?: string }
): Promise<MediaCommitResponse> {
  const committed: MediaCommitResponse["committed"] = [];
  if (options?.intentId) {
    const intent = await findMediaUploadIntentByIntentId(options.intentId);
    if (intent?.userId !== userId) {
      throw new Error("invalid_media_intent");
    }
    if (intent.expiresAt.getTime() < Date.now()) {
      throw new Error("media_intent_expired");
    }
    const providerMismatch = items.some(
      (item) => item.provider !== intent.provider
    );
    if (providerMismatch) {
      throw new Error("MEDIA_PROVIDER_MISMATCH");
    }
  }

  for (const item of items) {
    const mediaResult = await createMediaIfMissing({
      userId,
      url: item.url,
      sha256: item.sha256 ?? null,
      size: item.size,
      mimeType: item.mimeType,
      provider: item.provider,
    });

    const existingAsset = item.sha256
      ? await findMediaAssetByUserAndSha256(userId, item.sha256)
      : null;

    const asset =
      existingAsset ??
      (await createMediaAsset({
        userId,
        status: "uploaded",
        sourceMimeType: item.mimeType,
        sourceBytes: item.size,
        sha256: item.sha256 ?? null,
        sourceProvider: item.provider,
      }));

    const existingVariant = await findMediaVariantByAssetKindProviderUrl(
      asset.id,
      "original",
      item.provider,
      item.url
    );

    if (!existingVariant) {
      await createMediaVariant({
        assetId: asset.id,
        variantKind: "original",
        mimeType: item.mimeType,
        bytes: item.size,
        url: item.url,
        provider: item.provider,
        isPrimary: true,
        status: "pending",
      });
    }

    await updateMediaAssetStatus(asset.id, { status: "processing" });
    enqueueMediaProcessing(asset.id);

    committed.push({
      mediaId: mediaResult.id,
      assetId: asset.id,
      status: "processing",
      fileName: item.fileName,
      url: item.url,
    });
  }

  return { committed };
}
