/**
 * Settings loader data access. Prisma usage for settings page confined here.
 */

import { prisma } from "~/lib/prisma.server";

export async function findLatestPublishRelayAcksByUserAndUrls(
  userId: string,
  relayUrls: string[]
): Promise<
  Array<{
    relayUrl: string;
    status: string;
    createdAt: Date;
    receivedAt: Date | null;
  }>
> {
  if (relayUrls.length === 0) return [];
  try {
    return await prisma.publishRelayAck.findMany({
      where: { userId, relayUrl: { in: relayUrls } },
      orderBy: { createdAt: "desc" },
      distinct: ["relayUrl"],
    });
  } catch {
    return [];
  }
}
