/**
 * Push subscription data access. Prisma confined to feature repositories/ per architecture.
 */

import type { PushSubscription } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export interface CreatePushSubscriptionInput {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Create or update push subscription
 */
export async function upsertPushSubscription(
  input: CreatePushSubscriptionInput
): Promise<PushSubscription> {
  return prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    update: {
      p256dh: input.p256dh,
      auth: input.auth,
      userId: input.userId,
    },
    create: input,
  });
}

/**
 * Get all push subscriptions for a user
 */
export async function getUserPushSubscriptions(
  userId: string
): Promise<PushSubscription[]> {
  return prisma.pushSubscription.findMany({
    where: { userId },
  });
}

/**
 * Delete push subscription by endpoint
 */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.delete({
    where: { endpoint },
  });
}

/**
 * Delete all push subscriptions for a user
 */
export async function deleteUserPushSubscriptions(
  userId: string
): Promise<void> {
  await prisma.pushSubscription.deleteMany({
    where: { userId },
  });
}
