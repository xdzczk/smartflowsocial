import {
  BroadcastCampaignStatus,
  BroadcastRecipientStatus,
} from "@prisma/client";

import { appendBroadcastEventLog } from "~/features/broadcast/broadcast-activity-log.server";
import { looksSpammyMessage } from "~/features/broadcast/broadcast-guardrails.server";
import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import {
  cancelBroadcastRecipientJob,
  enqueueBroadcastRecipientJob,
} from "~/infra/queue";
import { prisma } from "~/lib/prisma.server";

import {
  BroadcastActionError,
  countBroadcastRecipientsFinalizedToday,
  getPlanContext,
  MSG_CAMPAIGN_NOT_FOUND,
  MSG_FOLLOWERS_AUDIENCE_REMOVED,
  toSignedEventShape,
} from "./broadcast-actions-shared.server";
import { resolveRecipientsForCampaign } from "./broadcast-recipients.server";
import type {
  CreateBroadcastDraftInput,
  FinalizeBroadcastInput,
} from "./broadcast-types";

export async function createBroadcastDraft(
  userId: string,
  input: CreateBroadcastDraftInput
): Promise<{ id: string }> {
  const { limits } = await getPlanContext(userId);
  if (!limits.allowedAudienceTypes.length) {
    throw new BroadcastActionError("Broadcasts require a paid plan", "PLAN");
  }
  if (
    !limits.allowedAudienceTypes.includes(
      input.audienceType as (typeof limits.allowedAudienceTypes)[number]
    )
  ) {
    throw new BroadcastActionError(
      "This audience type is not available on your plan",
      "AUDIENCE"
    );
  }
  if (
    input.deliveryMode !== "BEST_COMPATIBILITY" &&
    !limits.allowAdvancedDelivery
  ) {
    throw new BroadcastActionError(
      "Advanced delivery requires a higher plan",
      "PLAN"
    );
  }
  if (input.sendStrategy === "STAGGERED" && !limits.allowStaggered) {
    throw new BroadcastActionError(
      "Staggered sending is not available on your plan",
      "PLAN"
    );
  }
  let scheduledFor: Date | null = null;
  if (input.scheduledForIso) {
    if (!limits.allowSchedule) {
      throw new BroadcastActionError(
        "Scheduling is not available on your plan",
        "PLAN"
      );
    }
    scheduledFor = new Date(input.scheduledForIso);
    if (Number.isNaN(scheduledFor.getTime())) {
      throw new BroadcastActionError("Invalid schedule time", "VALIDATION");
    }
  }

  const id = await prisma.$transaction(async (tx) => {
    const row = await tx.broadcastCampaign.create({
      data: {
        userId,
        name: input.name,
        status: BroadcastCampaignStatus.DRAFT,
        audienceType: input.audienceType,
        messageBody: input.messageBody,
        deliveryMode: input.deliveryMode,
        sendStrategy: input.sendStrategy,
        scheduledFor,
        customNpubLines: input.customNpubLines,
        parseSnapshotJson:
          input.parseSnapshotJson === undefined
            ? undefined
            : (input.parseSnapshotJson as object),
        exclusionRulesJson:
          input.exclusionRulesJson === undefined
            ? undefined
            : (input.exclusionRulesJson as object),
      },
    });
    await appendBroadcastEventLog(
      {
        campaignId: row.id,
        eventType: "draft_created",
        message: "Draft created",
      },
      { tx }
    );
    return row.id;
  });
  return { id };
}

export async function finalizeBroadcastCampaign(
  userId: string,
  sessionPubkeyHex: string,
  input: FinalizeBroadcastInput
): Promise<{ enqueued: number }> {
  const { limits, planType } = await getPlanContext(userId);
  if (!getPlanEntitlements(planType).canSendBroadcast) {
    throw new BroadcastActionError(
      "Broadcast sending is available on paid plans.",
      "PLAN"
    );
  }
  const campaign = await prisma.broadcastCampaign.findFirst({
    where: { id: input.campaignId, userId },
    include: { recipients: true },
  });
  if (!campaign) {
    throw new BroadcastActionError(MSG_CAMPAIGN_NOT_FOUND, "NOT_FOUND");
  }
  if (
    campaign.status !== BroadcastCampaignStatus.DRAFT &&
    campaign.status !== BroadcastCampaignStatus.AWAITING_SIGNATURE
  ) {
    throw new BroadcastActionError("Campaign already finalized", "STATE");
  }
  if (looksSpammyMessage(campaign.messageBody)) {
    throw new BroadcastActionError(
      "Message looks repetitive; revise before sending",
      "SPAM"
    );
  }

  if (limits.maxDailyBroadcastRecipients > 0) {
    const usedToday = await countBroadcastRecipientsFinalizedToday(userId);
    if (
      usedToday + input.recipients.length >
      limits.maxDailyBroadcastRecipients
    ) {
      throw new BroadcastActionError(
        `Daily broadcast recipient limit exceeded (max ${String(
          limits.maxDailyBroadcastRecipients
        )} signed sends per UTC day).`,
        "LIMIT"
      );
    }
  }

  if (limits.maxConcurrentActiveCampaigns > 0) {
    const activeOthers = await prisma.broadcastCampaign.count({
      where: {
        userId,
        archivedAt: null,
        id: { not: input.campaignId },
        status: {
          in: [
            BroadcastCampaignStatus.SCHEDULED,
            BroadcastCampaignStatus.QUEUED,
            BroadcastCampaignStatus.SENDING,
            BroadcastCampaignStatus.PAUSED,
          ],
        },
      },
    });
    if (activeOthers >= limits.maxConcurrentActiveCampaigns) {
      throw new BroadcastActionError(
        `Too many active broadcasts (max ${String(
          limits.maxConcurrentActiveCampaigns
        )}). Cancel or finish one before starting another.`,
        "LIMIT"
      );
    }
  }

  const scheduledUnix = campaign.scheduledFor
    ? Math.floor(campaign.scheduledFor.getTime() / 1000)
    : 0;

  const pendingRecipients = campaign.recipients.filter(
    (r) => r.status === BroadcastRecipientStatus.PENDING
  );
  if (pendingRecipients.length !== input.recipients.length) {
    throw new BroadcastActionError(
      "Recipient batch must include every pending recipient exactly once",
      "VALIDATION"
    );
  }
  const pendingIds = new Set(pendingRecipients.map((r) => r.id));

  const recipientById = new Map(campaign.recipients.map((r) => [r.id, r]));
  const staggerMs =
    campaign.sendStrategy === "STAGGERED"
      ? 800 + Math.floor(Math.random() * 400)
      : 0;

  let index = 0;
  for (const batch of input.recipients) {
    const row = recipientById.get(batch.recipientId);
    if (row?.campaignId !== campaign.id || !pendingIds.has(batch.recipientId)) {
      throw new BroadcastActionError("Invalid recipient id", "VALIDATION");
    }
    if (!toSignedEventShape(batch.signedEvent)) {
      throw new BroadcastActionError("Invalid signedEvent shape", "VALIDATION");
    }
    const ev = batch.signedEvent;
    if (ev.pubkey.toLowerCase() !== sessionPubkeyHex.toLowerCase()) {
      throw new BroadcastActionError("Signed event pubkey mismatch", "PUBKEY");
    }
    if (ev.kind !== 4) {
      throw new BroadcastActionError(
        "Only kind 4 DMs supported in V1",
        "VALIDATION"
      );
    }
    const pTag = ev.tags.find((t) => t[0] === "p");
    const pHex = pTag?.[1]?.toLowerCase();
    if (pHex !== row.recipientPubkey.toLowerCase()) {
      throw new BroadcastActionError(
        "DM p tag does not match recipient",
        "PTAG"
      );
    }

    const publishRelays = batch.publishRelays ?? [];

    await prisma.broadcastRecipient.update({
      where: { id: row.id },
      data: {
        signedEvent: ev as object,
        giftWraps: batch.giftWraps ? (batch.giftWraps as object[]) : undefined,
        publishRelays,
        status: BroadcastRecipientStatus.READY,
      },
    });

    const additionalDelayMs = staggerMs * index;
    index += 1;

    await enqueueBroadcastRecipientJob({
      campaignId: campaign.id,
      recipientId: row.id,
      userId,
      scheduledForUnix: scheduledUnix,
      additionalDelayMs,
    });

    await prisma.broadcastRecipient.update({
      where: { id: row.id },
      data: { status: BroadcastRecipientStatus.QUEUED },
    });
  }

  const newStatus =
    scheduledUnix > Math.floor(Date.now() / 1000)
      ? BroadcastCampaignStatus.SCHEDULED
      : BroadcastCampaignStatus.QUEUED;

  await prisma.broadcastCampaign.update({
    where: { id: campaign.id },
    data: {
      status: newStatus,
      queuedCount: input.recipients.length,
      startedAt:
        newStatus === BroadcastCampaignStatus.QUEUED ? new Date() : null,
    },
  });

  await appendBroadcastEventLog({
    campaignId: campaign.id,
    eventType: "finalized",
    message: "Signed events stored and publish jobs enqueued",
    metadataJson: { count: input.recipients.length },
  });

  return { enqueued: input.recipients.length };
}

export async function cancelBroadcastCampaign(
  userId: string,
  campaignId: string
): Promise<void> {
  const campaign = await prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
    include: { recipients: { select: { id: true, status: true } } },
  });
  if (!campaign) {
    throw new BroadcastActionError(MSG_CAMPAIGN_NOT_FOUND, "NOT_FOUND");
  }
  const terminal: BroadcastCampaignStatus[] = [
    BroadcastCampaignStatus.COMPLETED,
    BroadcastCampaignStatus.COMPLETED_WITH_FAILURES,
    BroadcastCampaignStatus.CANCELLED,
    BroadcastCampaignStatus.FAILED,
  ];
  if (terminal.includes(campaign.status)) {
    return;
  }

  for (const r of campaign.recipients) {
    if (
      r.status === BroadcastRecipientStatus.QUEUED ||
      r.status === BroadcastRecipientStatus.READY
    ) {
      await cancelBroadcastRecipientJob(campaignId, r.id);
    }
  }

  await prisma.broadcastCampaign.update({
    where: { id: campaignId },
    data: {
      status: BroadcastCampaignStatus.CANCELLED,
      cancelledAt: new Date(),
    },
  });
  await appendBroadcastEventLog({
    campaignId,
    eventType: "cancelled",
    message: "Campaign cancelled by user",
  });
}

export async function deleteBroadcastDraft(
  userId: string,
  campaignId: string
): Promise<void> {
  const campaign = await prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
  });
  if (!campaign) {
    throw new BroadcastActionError(MSG_CAMPAIGN_NOT_FOUND, "NOT_FOUND");
  }
  if (
    campaign.status !== BroadcastCampaignStatus.DRAFT &&
    campaign.status !== BroadcastCampaignStatus.AWAITING_SIGNATURE
  ) {
    throw new BroadcastActionError("Only drafts can be deleted", "STATE");
  }
  await prisma.broadcastCampaign.delete({ where: { id: campaignId } });
}

export async function archiveBroadcastCampaign(
  userId: string,
  campaignId: string
): Promise<void> {
  const campaign = await prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
  });
  if (!campaign) {
    throw new BroadcastActionError(MSG_CAMPAIGN_NOT_FOUND, "NOT_FOUND");
  }
  await prisma.broadcastCampaign.update({
    where: { id: campaignId },
    data: { archivedAt: new Date() },
  });
}

export async function unarchiveBroadcastCampaign(
  userId: string,
  campaignId: string
): Promise<void> {
  const campaign = await prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
  });
  if (!campaign) {
    throw new BroadcastActionError(MSG_CAMPAIGN_NOT_FOUND, "NOT_FOUND");
  }
  await prisma.broadcastCampaign.update({
    where: { id: campaignId },
    data: { archivedAt: null },
  });
}

export async function duplicateBroadcastCampaign(
  userId: string,
  campaignId: string
): Promise<{ id: string }> {
  const src = await prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
  });
  if (!src) {
    throw new BroadcastActionError(MSG_CAMPAIGN_NOT_FOUND, "NOT_FOUND");
  }
  if (src.audienceType === "FOLLOWING") {
    throw new BroadcastActionError(
      "The “Following” audience is no longer available. Create a new broadcast using Mutuals or a custom list of accounts that follow you.",
      "AUDIENCE"
    );
  }
  if (src.audienceType === "FOLLOWERS") {
    throw new BroadcastActionError(MSG_FOLLOWERS_AUDIENCE_REMOVED, "AUDIENCE");
  }
  const row = await prisma.broadcastCampaign.create({
    data: {
      userId,
      name: `${src.name} (copy)`,
      status: BroadcastCampaignStatus.DRAFT,
      audienceType: src.audienceType,
      messageBody: src.messageBody,
      deliveryMode: src.deliveryMode,
      sendStrategy: src.sendStrategy,
      scheduledFor: null,
      customNpubLines: src.customNpubLines,
      parseSnapshotJson: src.parseSnapshotJson ?? undefined,
      exclusionRulesJson: src.exclusionRulesJson ?? undefined,
      duplicatedFromId: src.id,
    },
  });
  await appendBroadcastEventLog({
    campaignId: row.id,
    eventType: "draft_created",
    message: "Duplicated from another broadcast",
    metadataJson: { sourceCampaignId: src.id },
  });
  return { id: row.id };
}

export async function retryBroadcastFailedRecipients(
  userId: string,
  campaignId: string
): Promise<{ id: string }> {
  const src = await prisma.broadcastCampaign.findFirst({
    where: { id: campaignId, userId },
    include: {
      recipients: {
        where: { status: BroadcastRecipientStatus.FAILED },
        select: { recipientPubkey: true },
      },
    },
  });
  if (!src) {
    throw new BroadcastActionError(MSG_CAMPAIGN_NOT_FOUND, "NOT_FOUND");
  }
  if (src.recipients.length === 0) {
    throw new BroadcastActionError("No failed recipients to retry", "STATE");
  }
  const { id } = await createBroadcastDraft(userId, {
    name: `Retry: ${src.name}`,
    audienceType: "CUSTOM",
    customNpubLines: src.recipients.map((r) => r.recipientPubkey),
    messageBody: src.messageBody,
    deliveryMode: src.deliveryMode,
    sendStrategy: src.sendStrategy,
  });
  await resolveRecipientsForCampaign(userId, id);
  await appendBroadcastEventLog({
    campaignId: id,
    eventType: "retry_draft_created",
    message: `Retry draft for ${String(src.recipients.length)} failed recipient(s)`,
    metadataJson: { sourceCampaignId: src.id },
  });
  return { id };
}
