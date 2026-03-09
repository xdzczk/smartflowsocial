import { randomUUID } from "node:crypto";

import { loadUploadProviderSettings } from "~/features/user";

import {
  createMediaAsset,
  createMediaVariant,
  findMediaAssetByUserAndSha256,
  findMediaVariantByAssetKindProviderUrl,
  updateMediaAssetStatus,
} from "../repositories/media-data.server";

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
  files: MediaIntentFile[]
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

  return {
    intentId: randomUUID(),
    provider,
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
  items: MediaCommitItem[]
): Promise<MediaCommitResponse> {
  const committed: MediaCommitResponse["committed"] = [];

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
