import {
  findMediaAssetStatus,
  findMediaVariantByAssetAndKind,
} from "../repositories/media-data.server";

export async function resolveMediaVariantUrl(
  assetId: string,
  variantKind: string
): Promise<string | null> {
  const preferred = await findMediaVariantByAssetAndKind(assetId, variantKind, {
    status: "ready",
  });
  if (preferred?.url) return preferred.url;

  const fallback = await findMediaVariantByAssetAndKind(assetId, "original", {
    status: "ready",
  });
  return fallback?.url ?? null;
}

export async function getMediaAssetStatus(
  assetId: string
): Promise<string | null> {
  return findMediaAssetStatus(assetId);
}
