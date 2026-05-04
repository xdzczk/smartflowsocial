import { PublishRelayAckStatus } from "@prisma/client";

import type { RelayPublishResult } from "~/infra/publishers/nostr-publisher.server";
import { prisma } from "~/lib/prisma.server";

import { mapPublisherOkToAckStatus } from "../relay-resolution.server";

/**
 * Pre-publish: persist the canonical *intended* relay set for a publish
 * attempt as PENDING ACK rows.
 *
 * Why this exists:
 *   The original ACK persistence path only wrote rows for relays that the
 *   publisher actually returned a result for, which made it impossible to
 *   tell a "publisher silently skipped this relay" failure from a "this
 *   relay was never in the intended set" success  -  the user-visible bug
 *   manifested as `PublishResultModal` showing a 3-relay subset even when
 *   the user had configured 8+ relays. By inserting one PENDING row per
 *   intended relay before fanout, the modal can always render the full
 *   canonical set, and any row that stays PENDING is a real "we never
 *   heard back" gap rather than a UI inference.
 *
 * The unique constraint on (publishAttemptId, relayUrl) guarantees this is
 * safe to call more than once for the same attempt; later results will
 * upgrade these rows in-place via {@link persistPublishRelayAcks}.
 */
export async function persistIntendedPublishRelays(input: {
  publishAttemptId: string;
  userId: string;
  eventId: string;
  intendedRelays: readonly string[];
}): Promise<void> {
  const relays = Array.from(new Set(input.intendedRelays.filter(Boolean)));
  if (relays.length === 0) return;

  await prisma.publishRelayAck.createMany({
    data: relays.map((relayUrl) => ({
      publishAttemptId: input.publishAttemptId,
      userId: input.userId,
      eventId: input.eventId,
      relayUrl,
      status: PublishRelayAckStatus.PENDING,
      receivedAt: null,
    })),
    skipDuplicates: true,
  });
}

export async function persistPublishRelayAcks(input: {
  publishAttemptId: string;
  userId: string;
  eventId: string;
  results: RelayPublishResult[];
}): Promise<void> {
  const results = Array.isArray(input.results) ? input.results : [];
  if (results.length === 0) return;

  const now = new Date();

  // Upgrade strategy: each publisher result either lands as a brand-new ACK
  // row (no PENDING preregistration ran, e.g. legacy callers / API route)
  // or upgrades an existing PENDING row created by
  // persistIntendedPublishRelays. We keep both paths working by issuing an
  // upsert per relay rather than relying on createMany+skipDuplicates,
  // which would silently drop the upgrade.
  await Promise.all(
    results.map(async (r) => {
      const status = mapPublisherOkToAckStatus({ ok: r.ok, error: r.error });
      const receivedAt = status === "ACCEPTED" ? now : null;
      await prisma.publishRelayAck.upsert({
        where: {
          publishAttemptId_relayUrl: {
            publishAttemptId: input.publishAttemptId,
            relayUrl: r.relay,
          },
        },
        create: {
          publishAttemptId: input.publishAttemptId,
          userId: input.userId,
          eventId: input.eventId,
          relayUrl: r.relay,
          status,
          receivedAt,
        },
        update: {
          status,
          receivedAt,
        },
      });
    })
  );
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
