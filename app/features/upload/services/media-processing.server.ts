import {
  createMediaVariant,
  findMediaAssetById,
  findMediaVariantByAssetKindProviderUrl,
  updateMediaAssetStatus,
  updateMediaVariant,
} from "../repositories/media-data.server";

import { evaluateMediaPolicy } from "./media-policy.server";

function variantLabelForMediaClass(mediaClass: "image" | "video"): string[] {
  if (mediaClass === "image") {
    return ["thumb", "feed", "full"];
  }
  return ["poster"];
}

async function createAliasVariant(
  assetId: string,
  variantKind: string,
  mimeType: string,
  bytes: number,
  url: string,
  provider: string
) {
  const existing = await findMediaVariantByAssetKindProviderUrl(
    assetId,
    variantKind,
    provider,
    url
  );
  if (existing) return;

  await createMediaVariant({
    assetId,
    variantKind,
    mimeType,
    bytes,
    url,
    provider,
    isPrimary: false,
    status: "ready",
  });
}

export async function processMediaAsset(assetId: string): Promise<void> {
  const asset = await findMediaAssetById(assetId);
  if (!asset) return;

  const original = asset.variants[0];
  if (!original) {
    await updateMediaAssetStatus(assetId, {
      status: "failed",
      errorReason: "missing_original_variant",
    });
    return;
  }

  const policy = evaluateMediaPolicy({
    mimeType: original.mimeType,
    sizeBytes: original.bytes,
  });

  if (!policy.allowed) {
    await updateMediaAssetStatus(assetId, {
      status: "failed",
      errorReason: policy.reason,
    });
    await updateMediaVariant(original.id, { status: "failed" });
    return;
  }

  if (policy.mediaClass === "unknown") {
    await updateMediaAssetStatus(assetId, {
      status: "failed",
      errorReason: "unsupported_media_type",
    });
    return;
  }

  const variants = variantLabelForMediaClass(policy.mediaClass);
  for (const variant of variants) {
    await createAliasVariant(
      assetId,
      variant,
      original.mimeType,
      original.bytes,
      original.url,
      original.provider
    );
  }

  if (original.status !== "ready") {
    await updateMediaVariant(original.id, { status: "ready" });
  }

  await updateMediaAssetStatus(assetId, {
    status: "ready",
    errorReason: null,
    lastProcessedAt: new Date(),
  });
}

export function enqueueMediaProcessing(assetId: string): void {
  // Lightweight in-process queue; can be replaced by worker queue later.
  setTimeout(() => {
    void processMediaAsset(assetId);
  }, 0);
}
