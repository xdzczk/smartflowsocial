import { prisma } from "~/lib/prisma.server";

export interface ThreadGroupSegmentDTO {
  id: string;
  position: number;
  previewText: string;
  hasMedia: boolean;
}

/**
 * Segments in an app thread group, ordered by creation time.
 * Used by the post detail modal thread stack (not Nostr reply threading).
 */
export async function getThreadGroupSegmentsForUser(
  userId: string,
  threadGroupId: string,
  currentPostId: string
): Promise<{
  segments: ThreadGroupSegmentDTO[];
  currentIndex: number;
} | null> {
  const rows = await prisma.post.findMany({
    where: { userId, threadGroupId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      caption: true,
      content: true,
      fileUrl: true,
    },
  });

  if (rows.length === 0) return null;

  const segments: ThreadGroupSegmentDTO[] = rows.map((row, index) => {
    const text = (row.content?.trim() ?? row.caption?.trim() ?? "").slice(
      0,
      220
    );
    return {
      id: row.id,
      position: index + 1,
      previewText: text || "(No text)",
      hasMedia: Array.isArray(row.fileUrl) && row.fileUrl.length > 0,
    };
  });

  const currentIndex = segments.findIndex((s) => s.id === currentPostId);

  return { segments, currentIndex };
}
