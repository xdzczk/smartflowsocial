import { BroadcastSuppressionReasonCode } from "@prisma/client";

import { normalizePubkeyInput } from "~/features/broadcast/broadcast-resolve.server";
import { prisma } from "~/lib/prisma.server";

import { BroadcastActionError } from "./broadcast-actions-shared.server";

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
