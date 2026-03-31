import { type BroadcastAudienceType } from "@prisma/client";

import { getSubscriptionData } from "~/features/payments/subscriptions.server";
import {
  getBroadcastPlanLimits,
  getUserPlanType,
} from "~/features/payments/types";
import { prisma } from "~/lib/prisma.server";

export class BroadcastActionError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = "BroadcastActionError";
  }
}

export const MSG_CAMPAIGN_NOT_FOUND = "Campaign not found";
export const MSG_FOLLOWING_AUDIENCE_REMOVED =
  "The “Following” audience type is no longer available.";
export const MSG_FOLLOWERS_AUDIENCE_REMOVED =
  "Broadcasting to all followers is no longer available. Use Mutuals or a custom list of accounts that follow you.";
export const MSG_SAVED_AUDIENCE_NOT_FOUND = "Saved audience not found";

export async function countBroadcastRecipientsFinalizedToday(
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

export function emptyGraphAudienceMessage(
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

export async function getPlanContext(userId: string) {
  const { currentSubscription } = await getSubscriptionData(userId);
  const planType = getUserPlanType(currentSubscription);
  const limits = getBroadcastPlanLimits(planType);
  return { planType, limits, currentSubscription };
}

export function toSignedEventShape(raw: unknown): raw is {
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
