import { getUserSubscription } from "~/features/payments/data/payment.queries.server";
import { getPlanEntitlements } from "~/features/payments/entitlements/plan-entitlements";
import { countFutureScheduledItems } from "~/features/payments/entitlements/schedule-cap.server";
import {
  getUserPlanType,
  type UserSubscription,
} from "~/features/payments/types";

export class ScheduleCapExceededError extends Error {
  constructor(
    message = "You've reached the Free plan limit of 10 scheduled items. Upgrade to schedule more posts and unlock deeper workflow control."
  ) {
    super(message);
    this.name = "ScheduleCapExceededError";
  }
}

function subscriptionRowToUserSubscription(
  sub: Awaited<ReturnType<typeof getUserSubscription>>
): UserSubscription | null {
  if (!sub?.planId) return null;
  return {
    planId: sub.planId,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd ?? undefined,
    Plan: sub.Plan
      ? {
          name: sub.Plan.name,
          id: sub.Plan.id,
          enableLifetimeAccess: sub.Plan.enableLifetimeAccess
            ? true
            : undefined,
        }
      : undefined,
  };
}

/**
 * Throws ScheduleCapExceededError when creating additionalScheduledItems would exceed the plan cap.
 */
export async function assertScheduleCapacity(
  userId: string,
  additionalScheduledItems: number
): Promise<void> {
  if (additionalScheduledItems <= 0) return;
  const row = await getUserSubscription(userId);
  const us = subscriptionRowToUserSubscription(row);
  const planType = getUserPlanType(us);
  const { maxFutureScheduledItems } = getPlanEntitlements(planType);
  if (maxFutureScheduledItems == null) return;
  const current = await countFutureScheduledItems(userId);
  if (current + additionalScheduledItems > maxFutureScheduledItems) {
    throw new ScheduleCapExceededError();
  }
}
