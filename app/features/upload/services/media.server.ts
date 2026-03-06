/**
 * Media metadata service (Blossom uploads).
 * SmartFlow owns metadata; Blossom owns storage.
 */

import { env } from "~/lib/env.server";
import { logError } from "~/lib/error-logger.server";
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

export async function createMediaIfMissing(data: CreateMediaParams) {
  const existing = await prisma.media.findFirst({
    where: {
      userId: data.userId,
      url: data.url,
    },
    select: { id: true },
  });
  if (existing) {
    return { id: existing.id, created: false };
  }
  const created = await createMedia(data);
  return { id: created.id, created: true };
}

export async function listMediaForUser(
  userId: string,
  options: { skip: number; take: number; provider?: string }
) {
  const where: { userId: string; provider?: string } = { userId };
  if (options.provider) {
    where.provider = options.provider;
  }
  return prisma.media.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: options.skip,
    take: options.take,
  });
}

export async function getMediaAggregateForUser(
  userId: string,
  options?: { provider?: string }
) {
  const where: { userId: string; provider?: string } = { userId };
  if (options?.provider) {
    where.provider = options.provider;
  }
  return prisma.media.aggregate({
    where,
    _count: { id: true },
    _sum: { size: true },
  });
}

export async function getCanonicalOwnedBytesForUser(
  userId: string
): Promise<bigint> {
  const aggregate = await prisma.media.aggregate({
    where: {
      userId,
      OR: [{ provider: "S3" }, { provider: { startsWith: "BLOSSOM" } }],
    },
    _sum: { size: true },
  });
  return BigInt(aggregate._sum.size ?? 0);
}

export async function findMediaByIdForUser(mediaId: string, userId: string) {
  return prisma.media.findFirst({
    where: { id: mediaId, userId },
  });
}

export async function deleteMediaById(mediaId: string) {
  return prisma.media.delete({ where: { id: mediaId } });
}

function extractBlossomObjectKey(fileUrl: string): string | null {
  try {
    const parsed = new URL(fileUrl);
    const key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

/**
 * Delete a BLOSSOM_SFS object from the Blossom server storage (R2).
 * Uses trusted server-to-server internal secret.
 */
export async function deleteRemoteBlossomObject(
  fileUrl: string
): Promise<void> {
  const key = extractBlossomObjectKey(fileUrl);
  if (!key) {
    throw new Error("Invalid Blossom media URL; cannot derive object key");
  }

  const secret = env.BLOSSOM_INTERNAL_SECRET?.trim() ?? "";
  if (!secret) {
    throw new Error("BLOSSOM_INTERNAL_SECRET is not configured");
  }

  const configuredApiBase = env.BLOSSOM_SFS_API_URL?.trim();
  const apiBase =
    configuredApiBase === ""
      ? "https://blossom-api.smartflow.social"
      : (configuredApiBase ?? "https://blossom-api.smartflow.social");
  const endpoint = `${apiBase.replace(/\/$/, "")}/internal/blob/${encodeURIComponent(key)}`;

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      "x-internal-secret": secret,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const message = `Failed to delete Blossom object (${response.status})`;
    logError(new Error(message), {
      endpoint,
      key,
      status: response.status,
      responseBody: body.slice(0, 300),
    });
    throw new Error(message);
  }
}
