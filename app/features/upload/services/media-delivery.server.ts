import { prisma } from "~/lib/prisma.server";

export async function resolveMediaVariantUrl(
  assetId: string,
  variantKind: string
): Promise<string | null> {
  const preferred = await prisma.mediaVariant.findFirst({
    where: {
      assetId,
      variantKind,
      status: "ready",
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { url: true },
  });
  if (preferred?.url) return preferred.url;

  const fallback = await prisma.mediaVariant.findFirst({
    where: {
      assetId,
      variantKind: "original",
      status: "ready",
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { url: true },
  });
  return fallback?.url ?? null;
}

export async function getMediaAssetStatus(
  assetId: string
): Promise<string | null> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { status: true },
  });
  return asset?.status ?? null;
}
