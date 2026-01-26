import type { RelayPublishResult } from "~/infra/publishers/nostr-publisher.server";
import { prisma } from "~/lib/prisma.server";

import { mapPublisherOkToAckStatus } from "./relay-resolution.server";

export async function persistPublishRelayAcks(input: {
  publishAttemptId: string;
  userId: string;
  eventId: string;
  results: RelayPublishResult[];
}): Promise<void> {
  const results = Array.isArray(input.results) ? input.results : [];
  if (results.length === 0) return;

  const now = new Date();

  await prisma.publishRelayAck.createMany({
    data: results.map((r) => {
      const status = mapPublisherOkToAckStatus({ ok: r.ok, error: r.error });
      return {
        publishAttemptId: input.publishAttemptId,
        userId: input.userId,
        eventId: input.eventId,
        relayUrl: r.relay,
        status,
        receivedAt: status === "ACCEPTED" ? now : null,
      };
    }),
    skipDuplicates: true,
  });
}

/**
 * Get relay acknowledgements for a specific publish attempt
 */
export async function getPublishRelayAcksByAttemptId(
  publishAttemptId: string,
  userId: string
) {
  return prisma.publishRelayAck.findMany({
    where: {
      publishAttemptId,
      userId,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
