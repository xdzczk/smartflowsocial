import type {
  BillingNotificationChannel,
  BillingNotificationCommMode as PrismaBillingCommMode,
} from "@prisma/client";

import type { BillingNotificationCommMode } from "~/features/payments/types/subscription-billing.types";
import { prisma } from "~/lib/prisma.server";

const MS_DAY = 24 * 60 * 60 * 1000;

/**
 * Users whose subscription may need a billing DM (lookahead + grace + recent expiry).
 */
export async function findUsersForBillingNotifications(now: Date) {
  const horizon = new Date(now.getTime() + 10 * MS_DAY);
  const recentPast = new Date(now.getTime() - 3 * MS_DAY);

  return prisma.user.findMany({
    where: {
      isEnabled: true,
      Subscription: {
        is: {
          Plan: { is: { enableLifetimeAccess: false } },
          OR: [
            {
              currentPeriodEnd: {
                gt: now,
                lte: horizon,
              },
            },
            { gracePeriodEndsAt: { gt: now } },
            {
              currentPeriodEnd: {
                lt: now,
                gte: recentPast,
              },
            },
          ],
        },
      },
    },
    include: {
      Subscription: { include: { Plan: true } },
    },
  });
}

/**
 * Stable UTC ISO for dedupe keys (period boundary).
 */
export function periodEndIsoForDedupe(periodEnd: Date): string {
  return periodEnd.toISOString();
}

export function buildSubscriptionDedupeKey(
  eventType: string,
  subscriptionId: string,
  periodEnd: Date
): string {
  return `${eventType}:${subscriptionId}:${periodEndIsoForDedupe(periodEnd)}`;
}

export function buildGraceDedupeKey(
  eventType: string,
  subscriptionId: string,
  graceEndsAt: Date
): string {
  return `${eventType}:${subscriptionId}:grace:${graceEndsAt.toISOString()}`;
}

export async function getAttemptByDedupeKey(dedupeKey: string) {
  return prisma.subscriptionNotificationAttempt.findUnique({
    where: { dedupeKey },
  });
}

export async function createPendingAttempt(params: {
  userId: string;
  subscriptionId: string;
  planId: string | null;
  eventType: string;
  commMode: BillingNotificationCommMode;
  channel?: BillingNotificationChannel;
  dedupeKey: string;
}) {
  const now = new Date();
  return prisma.subscriptionNotificationAttempt.create({
    data: {
      userId: params.userId,
      subscriptionId: params.subscriptionId,
      planId: params.planId,
      eventType: params.eventType,
      commMode: params.commMode as PrismaBillingCommMode,
      channel: params.channel ?? "nostr_dm",
      dedupeKey: params.dedupeKey,
      status: "pending",
      attemptedAt: now,
    },
  });
}

export async function markAttemptSent(
  id: string,
  deliveryMetaJson: Record<string, unknown>
) {
  const now = new Date();
  return prisma.subscriptionNotificationAttempt.update({
    where: { id },
    data: {
      status: "sent",
      sentAt: now,
      attemptedAt: now,
      failureReason: null,
      deliveryMetaJson,
    },
  });
}

export async function markAttemptFailed(
  id: string,
  failureReason: string,
  deliveryMetaJson: Record<string, unknown>
) {
  const now = new Date();
  return prisma.subscriptionNotificationAttempt.update({
    where: { id },
    data: {
      status: "failed",
      attemptedAt: now,
      failureReason,
      deliveryMetaJson,
    },
  });
}

/**
 * If dedupeKey already has a successful send, returns { skip: true }.
 * If failed or pending exists, returns { retry: true, attempt } for same id update.
 * If none, returns { create: true }.
 */
export async function resolveDedupeForIntent(
  dedupeKey: string
): Promise<
  | { action: "skip"; reason: "already_sent" }
  | { action: "retry"; attemptId: string }
  | { action: "create" }
> {
  const existing = await getAttemptByDedupeKey(dedupeKey);
  if (!existing) {
    return { action: "create" };
  }
  if (existing.status === "sent") {
    return { action: "skip", reason: "already_sent" };
  }
  return { action: "retry", attemptId: existing.id };
}
