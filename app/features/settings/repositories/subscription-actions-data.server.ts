/**
 * Subscription actions data (cancel at period end, schedule downgrade). Prisma confined here.
 */

import { prisma } from "~/lib/prisma.server";

export async function updateSubscriptionCancelAtPeriodEnd(
  userId: string,
  cancelAtPeriodEnd: boolean
) {
  return prisma.subscription.update({
    where: { userId },
    data: { cancelAtPeriodEnd },
  });
}

export async function updateSubscriptionCancelAtPeriodEndAndMetadata(
  userId: string,
  data: { cancelAtPeriodEnd: boolean; metadata: Record<string, unknown> }
) {
  return prisma.subscription.update({
    where: { userId },
    data,
  });
}
