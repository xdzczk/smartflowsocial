import { MediaNotReadyError } from "~/lib/errors";
import { prisma } from "~/lib/prisma.server";

const MEDIA_URL_REGEX = /^\/media\/([^/]+)\/([^/]+)$/;

function extractAssetIdFromMediaUrl(url: string): string | null {
  const match = MEDIA_URL_REGEX.exec(url);
  return match?.[1] ?? null;
}

export async function getNotReadyAssetIds(urls: string[]): Promise<string[]> {
  const assetIds = Array.from(
    new Set(
      urls
        .map((url) => extractAssetIdFromMediaUrl(url))
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  if (assetIds.length === 0) return [];

  const rows = await prisma.mediaAsset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, status: true },
  });
  const statusById = new Map(rows.map((row) => [row.id, row.status]));
  return assetIds.filter((id) => statusById.get(id) !== "ready");
}

export async function assertMediaUrlsReady(urls: string[]): Promise<void> {
  const notReadyIds = await getNotReadyAssetIds(urls);
  if (notReadyIds.length > 0) {
    throw new MediaNotReadyError(
      "Media is still processing. Please retry in a moment.",
      { assetIds: notReadyIds }
    );
  }
}
