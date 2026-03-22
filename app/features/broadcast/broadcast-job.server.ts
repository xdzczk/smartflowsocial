/**
 * BullMQ handler: publish stored user-signed broadcast DMs (kind 4 + optional NIP-17 wraps).
 */

import {
  BroadcastCampaignStatus,
  BroadcastRecipientStatus,
} from "@prisma/client";
import type { Job } from "bullmq";

import { appendBroadcastEventLog } from "~/features/broadcast/broadcast-activity-log.server";
import { publishSignedEventToRelays } from "~/features/nostr/publish-event.server";
import type { SignedEvent } from "~/features/nostr/types";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import type { BroadcastJobData } from "~/infra/queue";
import { logError, logInfo } from "~/lib/error-logger.server";
import {
  giftWrapRecipientPubkeyHex,
  relaysForNip17GiftWrap,
  resolveCachedKind10050InboxRelays,
  resolveDmRelaysSafe,
} from "~/lib/nostr.messenger.server";
import { prisma } from "~/lib/prisma.server";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

function mergeRelayLists(
  userRelays: string[],
  dmRelays: string[],
  cap: number
): string[] {
  return Array.from(
    new Set([...userRelays, ...dmRelays].map((r) => r.trim()).filter(Boolean))
  ).slice(0, cap);
}

function parseGiftWraps(raw: unknown): SignedEvent[] {
  if (raw === null || raw === undefined) return [];
  if (!Array.isArray(raw)) return [];
  const out: SignedEvent[] = [];
  for (const item of raw) {
    try {
      out.push(validateSignedEventCryptographically(item));
    } catch {
      continue;
    }
  }
  return out;
}

export async function runBroadcastDmJob(
  job: Job<BroadcastJobData>
): Promise<{ success: boolean; skipped?: boolean }> {
  const { campaignId, recipientId, userId } = job.data;

  const row = await prisma.broadcastRecipient.findFirst({
    where: { id: recipientId, campaignId },
    include: {
      campaign: true,
    },
  });

  if (!row || row.campaign.userId !== userId) {
    logInfo("broadcast_dm_skip_missing_recipient", { recipientId, campaignId });
    return { success: true, skipped: true };
  }

  if (
    row.campaign.status === BroadcastCampaignStatus.CANCELLED ||
    row.campaign.status === BroadcastCampaignStatus.PAUSED
  ) {
    return { success: true, skipped: true };
  }

  if (
    row.status === BroadcastRecipientStatus.SENT &&
    row.publishedNip04EventId
  ) {
    return { success: true, skipped: true };
  }

  if (row.status === BroadcastRecipientStatus.FAILED) {
    return { success: true, skipped: true };
  }

  if (!row.signedEvent || typeof row.signedEvent !== "object") {
    await prisma.broadcastRecipient.update({
      where: { id: recipientId },
      data: {
        status: BroadcastRecipientStatus.FAILED,
        failureCode: "NO_SIGNED_EVENT",
        failureReason: "Missing signed event payload",
      },
    });
    await maybeCompleteCampaign(campaignId);
    return { success: false };
  }

  let validated: SignedEvent;
  try {
    validated = validateSignedEventCryptographically(row.signedEvent);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await prisma.broadcastRecipient.update({
      where: { id: recipientId },
      data: {
        status: BroadcastRecipientStatus.FAILED,
        failureCode: "INVALID_EVENT",
        failureReason: msg,
      },
    });
    await prisma.broadcastCampaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: 1 } },
    });
    await maybeCompleteCampaign(campaignId);
    return { success: false };
  }

  await prisma.broadcastRecipient.update({
    where: { id: recipientId },
    data: {
      status: BroadcastRecipientStatus.SENDING,
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
    },
  });

  if (row.campaign.status === BroadcastCampaignStatus.SCHEDULED) {
    await prisma.broadcastCampaign.update({
      where: { id: campaignId },
      data: { status: BroadcastCampaignStatus.SENDING, startedAt: new Date() },
    });
  }

  const receiverHex = row.recipientPubkey.toLowerCase();
  const senderHexLower = validated.pubkey.toLowerCase();

  const [userRelays, inboxDmRelays] = await Promise.all([
    resolveExecutionRelays(userId),
    resolveDmRelaysSafe(receiverHex),
  ]);
  const kind4Relays =
    row.publishRelays.length > 0
      ? row.publishRelays
      : mergeRelayLists(userRelays, inboxDmRelays, 24);

  try {
    const pub = await publishSignedEventToRelays({
      signedEvent: validated,
      relays: kind4Relays,
      correlationId: `broadcast:${campaignId}:${recipientId}:k4`,
    });
    const anyOk = pub.results.some((r) => r.ok);
    if (!anyOk && pub.results.length > 0) {
      const firstErr = pub.results.find((r) => r.error)?.error;
      throw new Error(firstErr ?? "Publish failed on all relays");
    }

    const wraps = parseGiftWraps(row.giftWraps);
    const recipientInboxRelays =
      await resolveCachedKind10050InboxRelays(receiverHex);
    for (const gw of wraps) {
      const pTag = giftWrapRecipientPubkeyHex(gw);
      if (!pTag) continue;
      const wrapRelays = await relaysForNip17GiftWrap({
        giftWrapPTag: pTag,
        receiverHexLower: receiverHex,
        recipientInboxRelays,
        senderHexLower,
      });
      await publishSignedEventToRelays({
        signedEvent: gw,
        relays: wrapRelays.length > 0 ? wrapRelays : kind4Relays,
        correlationId: `broadcast:${campaignId}:${recipientId}:nip17:${gw.id}`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.broadcastRecipient.update({
        where: { id: recipientId },
        data: {
          status: BroadcastRecipientStatus.SENT,
          publishedNip04EventId: validated.id,
          sentAt: new Date(),
          failureCode: null,
          failureReason: null,
        },
      });
      await tx.broadcastCampaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: 1 },
        },
      });
    });

    await maybeCompleteCampaign(campaignId);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logError(error instanceof Error ? error : new Error(msg), {
      message: "broadcast_dm_publish_failed",
      campaignId,
      recipientId,
    });
    await prisma.broadcastRecipient.update({
      where: { id: recipientId },
      data: {
        status: BroadcastRecipientStatus.FAILED,
        failureCode: "PUBLISH",
        failureReason: msg,
      },
    });
    await prisma.broadcastCampaign.update({
      where: { id: campaignId },
      data: { failedCount: { increment: 1 } },
    });
    await appendBroadcastEventLog({
      campaignId,
      level: "ERROR",
      eventType: "publish_failed",
      message: msg,
      metadataJson: { recipientId },
    });
    await maybeCompleteCampaign(campaignId);
    throw error instanceof Error ? error : new Error(msg);
  }
}

async function maybeCompleteCampaign(campaignId: string): Promise<void> {
  const camp = await prisma.broadcastCampaign.findUnique({
    where: { id: campaignId },
    select: { status: true },
  });
  if (
    !camp ||
    camp.status === BroadcastCampaignStatus.CANCELLED ||
    camp.status === BroadcastCampaignStatus.PAUSED
  ) {
    return;
  }

  const open = await prisma.broadcastRecipient.count({
    where: {
      campaignId,
      status: {
        in: [
          BroadcastRecipientStatus.PENDING,
          BroadcastRecipientStatus.READY,
          BroadcastRecipientStatus.QUEUED,
          BroadcastRecipientStatus.SENDING,
        ],
      },
    },
  });
  if (open > 0) return;

  await prisma.broadcastCampaign.update({
    where: { id: campaignId },
    data: {
      status: BroadcastCampaignStatus.COMPLETED,
      completedAt: new Date(),
    },
  });
}
