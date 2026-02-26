import { prisma } from "~/lib/prisma.server";

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
  const existing = await prisma.mediaVariant.findFirst({
    where: { assetId, variantKind, provider, url },
    select: { id: true },
  });
  if (existing) return;

  await prisma.mediaVariant.create({
    data: {
      assetId,
      variantKind,
      mimeType,
      bytes,
      url,
      provider,
      isPrimary: false,
      status: "ready",
    },
  });
}

export async function processMediaAsset(assetId: string): Promise<void> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: assetId },
    include: {
      variants: {
        where: { variantKind: "original" },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });
  if (!asset) return;

  const original = asset.variants[0];
  if (!original) {
    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: {
        status: "failed",
        errorReason: "missing_original_variant",
      },
    });
    return;
  }

  const policy = evaluateMediaPolicy({
    mimeType: original.mimeType,
    sizeBytes: original.bytes,
  });

  if (!policy.allowed) {
    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: "failed", errorReason: policy.reason },
    });
    await prisma.mediaVariant.update({
      where: { id: original.id },
      data: { status: "failed" },
    });
    return;
  }

  if (policy.mediaClass === "unknown") {
    await prisma.mediaAsset.update({
      where: { id: assetId },
      data: { status: "failed", errorReason: "unsupported_media_type" },
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

  await prisma.mediaAsset.update({
    where: { id: assetId },
    data: {
      status: "ready",
      errorReason: null,
      lastProcessedAt: new Date(),
    },
  });
}

export function enqueueMediaProcessing(assetId: string): void {
  // Lightweight in-process queue; can be replaced by worker queue later.
  setTimeout(() => {
    void processMediaAsset(assetId);
  }, 0);
}
