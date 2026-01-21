import { prisma } from "~/lib/prisma.server";

export async function cleanupPublishRelayAcks(input?: {
  olderThanDays?: number;
}): Promise<{ success: true; deletedCount: number; cutoffIso: string }> {
  const olderThanDays = Math.max(1, input?.olderThanDays ?? 30);
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const result = await prisma.publishRelayAck.deleteMany({
    where: {
      createdAt: { lt: cutoff },
    },
  });

  return {
    success: true,
    deletedCount: result.count,
    cutoffIso: cutoff.toISOString(),
  };
}
