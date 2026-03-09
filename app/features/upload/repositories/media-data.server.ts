/**
 * Media, MediaAsset, MediaVariant data access. All prisma usage for upload media confined here.
 */

import type { MediaAssetStatus, MediaVariantStatus } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

// --- Media (media.server.ts)
export async function createMedia(data: {
  userId: string;
  url: string;
  sha256?: string | null;
  size?: number | null;
  mimeType?: string | null;
  provider: string;
}) {
  return prisma.media.create({
    data: {
      userId: data.userId,
      url: data.url,
      sha256: data.sha256 ?? null,
      size: data.size ?? null,
      mimeType: data.mimeType ?? null,
      provider: data.provider,
    },
  });
}

export async function findMediaByUserAndUrl(userId: string, url: string) {
  return prisma.media.findFirst({
    where: { userId, url },
    select: { id: true },
  });
}

export async function findMediaManyByUser(
  userId: string,
  options: { skip: number; take: number; provider?: string }
) {
  const where: { userId: string; provider?: string } = { userId };
  if (options.provider) where.provider = options.provider;
  return prisma.media.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: options.skip,
    take: options.take,
  });
}

export async function aggregateMediaByUser(
  userId: string,
  options?: { provider?: string }
) {
  const where: { userId: string; provider?: string } = { userId };
  if (options?.provider) where.provider = options.provider;
  return prisma.media.aggregate({
    where,
    _count: { id: true },
    _sum: { size: true },
  });
}

export async function aggregateCanonicalOwnedBytes(userId: string) {
  const aggregate = await prisma.media.aggregate({
    where: {
      userId,
      OR: [{ provider: "S3" }, { provider: { startsWith: "BLOSSOM" } }],
    },
    _sum: { size: true },
  });
  return BigInt(aggregate._sum.size ?? 0);
}

export async function findMediaByIdAndUser(mediaId: string, userId: string) {
  return prisma.media.findFirst({
    where: { id: mediaId, userId },
  });
}

export async function deleteMediaById(mediaId: string) {
  return prisma.media.delete({ where: { id: mediaId } });
}

// --- MediaAsset (media-ingest, media-processing, media-readiness)
export async function findMediaAssetByUserAndSha256(
  userId: string,
  sha256: string
) {
  return prisma.mediaAsset.findFirst({
    where: { userId, sha256 },
    select: { id: true },
  });
}

export async function createMediaAsset(data: {
  userId: string;
  status: string;
  sourceMimeType: string;
  sourceBytes: number;
  sha256: string | null;
  sourceProvider: string;
}) {
  return prisma.mediaAsset.create({
    data: { ...data, status: data.status as MediaAssetStatus },
  });
}

export async function findMediaAssetById(assetId: string) {
  return prisma.mediaAsset.findUnique({
    where: { id: assetId },
    include: {
      variants: {
        where: { variantKind: "original" },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
}

export async function updateMediaAssetStatus(
  assetId: string,
  data: { status: string; errorReason?: string | null; lastProcessedAt?: Date }
) {
  return prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      ...data,
      status: data.status as MediaAssetStatus,
    },
  });
}

export async function findMediaAssetsByIds(assetIds: string[]) {
  if (assetIds.length === 0) return [];
  return prisma.mediaAsset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, status: true },
  });
}

// --- MediaVariant (media-delivery, media-processing)
export async function findMediaVariantByAssetAndKind(
  assetId: string,
  variantKind: string,
  options?: { status?: string; url?: string }
) {
  const where: {
    assetId: string;
    variantKind: string;
    status?: MediaVariantStatus;
    url?: string;
  } = { assetId, variantKind };
  if (options?.status) where.status = options.status as MediaVariantStatus;
  if (options?.url) where.url = options.url;
  return prisma.mediaVariant.findFirst({
    where,
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { url: true },
  });
}

export async function findMediaVariantByAssetKindProviderUrl(
  assetId: string,
  variantKind: string,
  provider: string,
  url: string
) {
  return prisma.mediaVariant.findFirst({
    where: { assetId, variantKind, provider, url },
    select: { id: true },
  });
}

export async function createMediaVariant(data: {
  assetId: string;
  variantKind: string;
  mimeType?: string | null;
  bytes?: number | null;
  url: string;
  provider: string;
  isPrimary: boolean;
  status: string;
}) {
  return prisma.mediaVariant.create({
    data: {
      assetId: data.assetId,
      variantKind: data.variantKind,
      mimeType: data.mimeType ?? "",
      bytes: data.bytes ?? 0,
      url: data.url,
      provider: data.provider,
      isPrimary: data.isPrimary,
      status: data.status as MediaVariantStatus,
    },
  });
}

export async function updateMediaVariant(
  variantId: string,
  data: { status?: string }
) {
  return prisma.mediaVariant.update({
    where: { id: variantId },
    data:
      data.status !== undefined
        ? { status: data.status as MediaVariantStatus }
        : {},
  });
}

export async function findMediaAssetStatus(assetId: string) {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    select: { status: true },
  });
  return asset?.status ?? null;
}
