/**
 * Media metadata service (Blossom uploads).
 * SmartFlow owns metadata; Blossom owns storage.
 */

import { prisma } from "~/lib/prisma.server";

export interface CreateMediaParams {
  userId: string;
  url: string;
  sha256?: string | null;
  size?: number | null;
  mimeType?: string | null;
  provider: string;
}

export async function createMedia(data: CreateMediaParams) {
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

export async function listMediaForUser(
  userId: string,
  options: { skip: number; take: number }
) {
  return prisma.media.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    skip: options.skip,
    take: options.take,
  });
}

export async function getMediaAggregateForUser(userId: string) {
  return prisma.media.aggregate({
    where: { userId },
    _count: { id: true },
    _sum: { size: true },
  });
}

export async function findMediaByIdForUser(mediaId: string, userId: string) {
  return prisma.media.findFirst({
    where: { id: mediaId, userId },
  });
}

export async function deleteMediaById(mediaId: string) {
  return prisma.media.delete({ where: { id: mediaId } });
}
