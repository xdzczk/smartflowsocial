import {
  BroadcastCampaignStatus,
  BroadcastRecipientStatus,
  BroadcastSuppressionReasonCode,
  type BroadcastAudienceType,
  type Prisma,
} from "@prisma/client";

import { appendBroadcastEventLog } from "~/features/broadcast/broadcast-activity-log.server";
import { looksSpammyMessage } from "~/features/broadcast/broadcast-guardrails.server";
import {
  applySuppressionAndSelf,
  normalizePubkeyInput,
  resolveAudiencePubkeys,
} from "~/features/broadcast/broadcast-resolve.server";
import { getSubscriptionData } from "~/features/payments/subscriptions.server";
import {
  getBroadcastPlanLimits,
  getUserPlanType,
} from "~/features/payments/types";
import { getUserById } from "~/features/user";
import {
  cancelBroadcastRecipientJob,
  enqueueBroadcastRecipientJob,
} from "~/infra/queue";
import { prisma } from "~/lib/prisma.server";

import type {
  CreateBroadcastDraftInput,
  FinalizeBroadcastInput,
} from "./broadcast-types";

export class BroadcastActionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "BroadcastActionError";
  }
}

const MSG_CAMPAIGN_NOT_FOUND = "Campaign not found";

async function countBroadcastRecipientsFinalizedToday(
  userId: string
): Promise<number> {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const logs = await prisma.broadcastEventLog.findMany({
    where: {
      eventType: "finalized",
      createdAt: { gte: start },
      campaign: { userId },
    },
    select: { metadataJson: true },
  });
  let n = 0;
  for (const l of logs) {
    const raw =
      l.metadataJson &&
      typeof l.metadataJson === "object" &&
      "count" in l.metadataJson
        ? (l.metadataJson as { count?: unknown }).count
        : undefined;
    const c = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(c)) n += c;
  }
  return n;
}

function emptyGraphAudienceMessage(
  audienceType: BroadcastAudienceType
): string {
  switch (audienceType) {
    case "FOLLOWING":
      return "No accounts found in your follow list (kind 3).";
    case "FOLLOWERS":
      return "No followers were found for your account in the Nostr cache.";
    case "MUTUALS":
      return "No mutual follows found for this audience.";
    default:
      return "No recipients in this audience.";
  }
}

async function getPlanContext(userId: string) {
  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);
  return { planType, limits };
}

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

export async function resolveRecipientsForCampaign(
  userId: string,
  campaignId: string
): Promise<{
  total: number;
  suppressed: number;
  invalidCustom: number;
}> {
  const { limits } = await getPlanContext(userId);
  const user = await getUserById(userId);
  if (!user?.npub) {
    throw new BroadcastActionError("User npub missing", "USER");
  }
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
    throw new BroadcastActionError(
      "Audience is locked for this campaign",
      "STATE"
    );
  }

  const senderHex =
    (await import("~/lib/nostr-adapter.server")).nostrAdapter.decodeNpub(
      user.npub
    ) ?? user.npub;
  if (!/^[0-9a-f]{64}$/i.test(senderHex)) {
    throw new BroadcastActionError("Invalid account pubkey", "USER");
  }

  const suppressRows = await prisma.broadcastSuppression.findMany({
    where: {
      userId,
      OR: [
        { permanent: true },
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    select: { recipientPubkey: true },
  });
  const suppressed = new Set(
    suppressRows.map((r) => r.recipientPubkey.toLowerCase())
  );

  const { pubkeys, invalidCustom, graphFetchFailed } =
    await resolveAudiencePubkeys({
      audienceType: campaign.audienceType,
      customLines: campaign.customNpubLines,
      senderPubkeyHex: senderHex.toLowerCase(),
    });

  const { included, suppressedCount } = applySuppressionAndSelf({
    pubkeys,
    selfPubkeyHex: senderHex,
    suppressed,
  });

  if (
    included.length === 0 &&
    campaign.audienceType !== "CUSTOM" &&
    graphFetchFailed
  ) {
    throw new BroadcastActionError(
      "The Nostr cache could not load your social graph (temporary error). Try again in a few minutes, or use a Custom recipient list.",
      "GRAPH_CACHE"
    );
  }

  if (included.length === 0 && campaign.audienceType !== "CUSTOM") {
    if (pubkeys.length === 0) {
      throw new BroadcastActionError(
        emptyGraphAudienceMessage(campaign.audienceType),
        "EMPTY_AUDIENCE"
      );
    }
    throw new BroadcastActionError(
      "Everyone in this audience is suppressed or is your own pubkey. Adjust suppression or choose another audience.",
      "ALL_SUPPRESSED"
    );
  }

  if (included.length > limits.maxRecipientsPerCampaign) {
    throw new BroadcastActionError(
      `Too many recipients (max ${String(limits.maxRecipientsPerCampaign)})`,
      "LIMIT"
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.broadcastRecipient.deleteMany({ where: { campaignId } });
    const data: Prisma.BroadcastRecipientCreateManyInput[] = included.map(
      (recipientPubkey) => ({
        campaignId,
        recipientPubkey,
        sourceType: campaign.audienceType,
        status: BroadcastRecipientStatus.PENDING,
      })
    );
    if (data.length) {
      await tx.broadcastRecipient.createMany({ data });
    }
    await tx.broadcastCampaign.update({
      where: { id: campaignId },
      data: {
        totalRecipients: included.length,
        suppressedCount,
        skippedCount: 0,
        failedCount: 0,
        sentCount: 0,
        queuedCount: 0,
        status:
          included.length > 0
            ? BroadcastCampaignStatus.AWAITING_SIGNATURE
            : BroadcastCampaignStatus.DRAFT,
      },
    });
  });

  await appendBroadcastEventLog({
    campaignId,
    eventType: "audience_resolved",
    message: `Resolved ${String(included.length)} recipients`,
    metadataJson: {
      suppressedCount,
      invalidCustom,
    },
  });

  return {
    total: included.length,
    suppressed: suppressedCount,
    invalidCustom,
  };
}

function toSignedEventShape(raw: unknown): raw is {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
  sig: string;
} {
  if (!raw || typeof raw !== "object") return false;
  const o = raw as Record<string, unknown>;
  return (
    typeof o["id"] === "string" &&
    typeof o["pubkey"] === "string" &&
    typeof o["created_at"] === "number" &&
    typeof o["kind"] === "number" &&
    Array.isArray(o["tags"]) &&
    typeof o["content"] === "string" &&
    typeof o["sig"] === "string"
  );
}

export async function finalizeBroadcastCampaign(
  userId: string,
  sessionPubkeyHex: string,
  input: FinalizeBroadcastInput
): Promise<{ enqueued: number }> {
  const { limits } = await getPlanContext(userId);
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

export async function addBroadcastSuppression(
  userId: string,
  recipientPubkeyOrNpub: string,
  options?: {
    reason?: string;
    reasonCode?: BroadcastSuppressionReasonCode;
    permanent?: boolean;
    expiresAt?: Date | null;
    createdFromCampaignId?: string | null;
  }
): Promise<void> {
  const pk = normalizePubkeyInput(recipientPubkeyOrNpub);
  if (!pk) {
    throw new BroadcastActionError("Invalid npub or hex pubkey", "VALIDATION");
  }
  const reasonCode =
    options?.reasonCode ?? BroadcastSuppressionReasonCode.OTHER;
  await prisma.broadcastSuppression.upsert({
    where: {
      userId_recipientPubkey: { userId, recipientPubkey: pk },
    },
    create: {
      userId,
      recipientPubkey: pk,
      reason: options?.reason ?? null,
      reasonCode,
      permanent: options?.permanent ?? true,
      expiresAt: options?.expiresAt ?? null,
      createdFromCampaignId: options?.createdFromCampaignId ?? null,
    },
    update: {
      reason: options?.reason ?? null,
      reasonCode,
      ...(options?.permanent !== undefined
        ? { permanent: options.permanent }
        : {}),
      ...(options?.expiresAt !== undefined
        ? { expiresAt: options.expiresAt }
        : {}),
    },
  });
}

export async function removeBroadcastSuppression(
  userId: string,
  recipientPubkey: string
): Promise<void> {
  const pk =
    normalizePubkeyInput(recipientPubkey) ?? recipientPubkey.toLowerCase();
  await prisma.broadcastSuppression.deleteMany({
    where: { userId, recipientPubkey: pk },
  });
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

export async function listBroadcastSavedAudiences(userId: string) {
  return prisma.broadcastSavedAudience.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
}

export async function createBroadcastSavedAudience(
  userId: string,
  input: {
    name: string;
    audienceType: BroadcastAudienceType;
    customNpubLines: string[];
    ruleSummary?: string;
  }
) {
  return prisma.broadcastSavedAudience.create({
    data: {
      userId,
      name: input.name,
      audienceType: input.audienceType,
      customNpubLines: input.customNpubLines,
      ruleSummary: input.ruleSummary ?? null,
    },
  });
}

export async function deleteBroadcastSavedAudience(
  userId: string,
  id: string
): Promise<void> {
  const row = await prisma.broadcastSavedAudience.findFirst({
    where: { id, userId },
  });
  if (!row) {
    throw new BroadcastActionError("Saved audience not found", "NOT_FOUND");
  }
  await prisma.broadcastSavedAudience.delete({ where: { id } });
}
