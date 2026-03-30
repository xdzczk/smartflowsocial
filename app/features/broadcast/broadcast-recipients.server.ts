import {
  BroadcastCampaignStatus,
  BroadcastRecipientStatus,
  type Prisma,
} from "@prisma/client";

import { appendBroadcastEventLog } from "~/features/broadcast/broadcast-activity-log.server";
import {
  applySuppressionAndSelf,
  resolveAudiencePubkeys,
} from "~/features/broadcast/broadcast-resolve.server";
import { getUserById } from "~/features/user";
import { prisma } from "~/lib/prisma.server";

import {
  BroadcastActionError,
  emptyGraphAudienceMessage,
  getPlanContext,
  MSG_CAMPAIGN_NOT_FOUND,
  MSG_FOLLOWERS_AUDIENCE_REMOVED,
} from "./broadcast-actions-shared.server";

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
  if (campaign.audienceType === "FOLLOWERS") {
    throw new BroadcastActionError(MSG_FOLLOWERS_AUDIENCE_REMOVED, "AUDIENCE");
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

  const {
    pubkeys,
    invalidCustom,
    graphFetchFailed,
    excludedNonFollowers = 0,
  } = await resolveAudiencePubkeys({
    audienceType: campaign.audienceType,
    customLines: campaign.customNpubLines,
    senderPubkeyHex: senderHex.toLowerCase(),
  });

  if (campaign.audienceType === "CUSTOM" && graphFetchFailed) {
    throw new BroadcastActionError(
      "Could not load your follower list to verify custom recipients. Try again in a few minutes.",
      "GRAPH_CACHE"
    );
  }

  let { included, suppressedCount } = applySuppressionAndSelf({
    pubkeys,
    selfPubkeyHex: senderHex,
    suppressed,
  });
  const includedAfterSuppression = included.length;

  let excludedRecentMessaged = 0;
  const rules = campaign.exclusionRulesJson as
    | {
        excludeMessagedWithinDays?: number;
        excludePriorBroadcastRecipients?: boolean;
      }
    | null
    | undefined;
  if (
    rules &&
    typeof rules.excludeMessagedWithinDays === "number" &&
    rules.excludeMessagedWithinDays > 0
  ) {
    const days = Math.min(
      365,
      Math.max(1, Math.floor(rules.excludeMessagedWithinDays))
    );
    const since = new Date(Date.now() - days * 86400000);
    const recentRows = await prisma.broadcastRecipient.findMany({
      where: {
        campaign: { userId },
        sentAt: { gte: since },
        status: BroadcastRecipientStatus.SENT,
      },
      select: { recipientPubkey: true },
    });
    const recentSet = new Set(
      recentRows.map((r) => r.recipientPubkey.toLowerCase())
    );
    const before = included.length;
    included = included.filter((p) => !recentSet.has(p.toLowerCase()));
    excludedRecentMessaged = before - included.length;
  }

  let excludedPriorBroadcast = 0;
  if (rules?.excludePriorBroadcastRecipients === true) {
    const priorRecipients = await prisma.broadcastRecipient.findMany({
      where: {
        campaign: { userId, id: { not: campaignId } },
        status: BroadcastRecipientStatus.SENT,
      },
      select: { recipientPubkey: true },
    });
    const priorSet = new Set(
      priorRecipients.map((r) => r.recipientPubkey.toLowerCase())
    );
    const beforePrior = included.length;
    included = included.filter((p) => !priorSet.has(p.toLowerCase()));
    excludedPriorBroadcast = beforePrior - included.length;
  }

  if (included.length === 0 && campaign.audienceType === "CUSTOM") {
    if (pubkeys.length === 0) {
      if (excludedNonFollowers > 0) {
        throw new BroadcastActionError(
          "None of the accounts you listed follow you. You can only message people who follow you.",
          "EMPTY_AUDIENCE"
        );
      }
      if (invalidCustom > 0) {
        throw new BroadcastActionError(
          "No valid recipients. Fix invalid lines or add pubkeys that follow you.",
          "EMPTY_AUDIENCE"
        );
      }
      throw new BroadcastActionError(
        "Add at least one recipient who follows you.",
        "EMPTY_AUDIENCE"
      );
    }
    if (includedAfterSuppression === 0) {
      throw new BroadcastActionError(
        "Everyone in this audience is suppressed or is your own pubkey. Adjust suppression or choose another audience.",
        "ALL_SUPPRESSED"
      );
    }
    throw new BroadcastActionError(
      "Everyone in this audience was excluded by your rules (recent messages or prior broadcast). Adjust exclusions or choose another audience.",
      "EMPTY_AUDIENCE"
    );
  }

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
      excludedNonFollowers,
      excludedRecentMessaged,
      excludedPriorBroadcast,
    },
  });

  return {
    total: included.length,
    suppressed: suppressedCount,
    invalidCustom,
  };
}
