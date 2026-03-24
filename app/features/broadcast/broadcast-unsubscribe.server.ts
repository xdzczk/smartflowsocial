/**
 * In-DM broadcast unsubscribe: capability tokens derived per BroadcastRecipient row
 * (HMAC with server secret). DB stores only SHA-256 of the raw token for lookup.
 */

import {
  BroadcastCampaignStatus,
  BroadcastRecipientStatus,
  BroadcastSuppressionReasonCode,
} from "@prisma/client";

import { env } from "~/lib/env.server";
import { logInfo } from "~/lib/error-logger.server";
import { prisma } from "~/lib/prisma.server";

import { addBroadcastSuppression } from "./broadcast-actions.server";
import {
  buildBroadcastUnsubscribeUrl,
  deriveBroadcastUnsubscribeRawToken as deriveWithSecret,
  hashBroadcastUnsubscribeToken,
} from "./broadcast-unsubscribe-crypto";

export function deriveBroadcastUnsubscribeRawToken(
  recipientId: string
): string {
  return deriveWithSecret(recipientId, env.SESSION_SECRET);
}

export function getBroadcastUnsubscribeBaseUrl(request: Request): string {
  const fromEnv = env.APP_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  const u = new URL(request.url);
  return `${u.protocol}//${u.host}`;
}

export interface PendingRecipientUnsubscribe {
  id: string;
  recipientPubkey: string;
  unsubscribeUrl: string;
}

/**
 * Ensures token rows exist for PENDING recipients and returns URLs for signing.
 */
export async function ensureUnsubscribeTokensForCampaign(
  userId: string,
  campaignId: string,
  baseUrl: string
): Promise<PendingRecipientUnsubscribe[]> {
  const campaign = await prisma.broadcastCampaign.findFirst({
    where: {
      id: campaignId,
      userId,
      status: {
        in: [
          BroadcastCampaignStatus.DRAFT,
          BroadcastCampaignStatus.AWAITING_SIGNATURE,
        ],
      },
    },
    select: {
      id: true,
      recipients: {
        where: { status: BroadcastRecipientStatus.PENDING },
        orderBy: { createdAt: "asc" },
        select: { id: true, recipientPubkey: true },
      },
    },
  });

  if (!campaign) {
    return [];
  }

  const out: PendingRecipientUnsubscribe[] = [];

  await prisma.$transaction(async (tx) => {
    for (const r of campaign.recipients) {
      const rawToken = deriveBroadcastUnsubscribeRawToken(r.id);
      const tokenHash = hashBroadcastUnsubscribeToken(rawToken);
      await tx.broadcastUnsubscribeToken.upsert({
        where: { recipientId: r.id },
        create: {
          recipientId: r.id,
          tokenHash,
        },
        update: {},
      });
      out.push({
        id: r.id,
        recipientPubkey: r.recipientPubkey,
        unsubscribeUrl: buildBroadcastUnsubscribeUrl(rawToken, baseUrl),
      });
    }
  });

  return out;
}

/**
 * Applies suppression from raw token; returns whether a valid token was processed.
 * Invalid / unknown tokens return false (caller should still show a generic success page).
 */
export async function applyUnsubscribeFromRawToken(
  rawToken: string | null | undefined
): Promise<boolean> {
  const t = rawToken?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/i.test(t)) {
    return false;
  }

  const normalized = t.toLowerCase();
  const tokenHash = hashBroadcastUnsubscribeToken(normalized);

  const row = await prisma.broadcastUnsubscribeToken.findFirst({
    where: { tokenHash },
    include: {
      recipient: {
        include: { campaign: true },
      },
    },
  });

  if (!row) {
    return false;
  }

  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
    return false;
  }

  const campaign = row.recipient.campaign;
  const recipientPubkey = row.recipient.recipientPubkey;
  const broadcasterUserId = campaign.userId;

  await addBroadcastSuppression(broadcasterUserId, recipientPubkey, {
    reasonCode: BroadcastSuppressionReasonCode.MANUAL_OPT_OUT,
    createdFromCampaignId: campaign.id,
  });

  if (!row.usedAt) {
    await prisma.broadcastUnsubscribeToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    });
  }

  logInfo("broadcast_unsubscribe_applied", {
    tokenRowIdPrefix: row.id.slice(0, 8),
    campaignIdPrefix: campaign.id.slice(0, 8),
  });

  return true;
}
