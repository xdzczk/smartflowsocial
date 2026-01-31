import { redirect } from "@remix-run/node";

import { prisma } from "~/lib/prisma.server";
import {
  ensureUserHasFreePlan,
  getUserSubscription,
} from "~/models/payment.server";

export { ensureUserHasFreePlan } from "~/models/payment.server";

import type { FeatureName, SubscriptionData } from "./types";

/** Redirect when user account is disabled (never to /plans). */
const LANDING = "/";

/**
 * Ensure user has free plan, then get subscription data. Throws redirect if user is disabled.
 */
async function ensureFreeAndGetSubscriptionData(
  userId: string
): Promise<SubscriptionData> {
  await ensureUserHasFreePlan(userId);
  const data = await getSubscriptionData(userId);
  if (!data.user?.isEnabled) {
    throw redirect(LANDING);
  }
  return data;
}

/**
 * Ensure user has at least a free subscription, then return subscription data.
 * Never redirects to /plans; missing or inactive subscription is handled by
 * ensuring free plan. Callers use returned data to show banners (e.g. free plan, expired paid).
 */
export async function requireFeatureAccess(
  userId: string,
  _feature: FeatureName
): Promise<SubscriptionData> {
  return ensureFreeAndGetSubscriptionData(userId);
}

/**
 * Ensure user has at least a free subscription. Never redirects to /plans.
 */
export async function requireAnySubscription(userId: string): Promise<void> {
  await ensureUserHasFreePlan(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isEnabled: true },
  });

  if (!user?.isEnabled) {
    throw redirect(LANDING);
  }
}

/**
 * Ensure user has at least a free subscription; return subscription data.
 * If paid plan has expired (status !== ACTIVE), we do not redirect; UI shows an expired banner.
 */
export async function requireActiveSubscription(
  userId: string
): Promise<SubscriptionData> {
  return ensureFreeAndGetSubscriptionData(userId);
}

/**
 * Get subscription data without enforcing access (for informational purposes)
 */
export async function getSubscriptionData(
  userId: string
): Promise<SubscriptionData> {
  // Get user's enabled status and subscription
  const [user, currentSubscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isEnabled: true },
    }),
    getUserSubscription(userId),
  ]);

  return {
    user: user ? { id: userId, isEnabled: user.isEnabled } : null,
    currentSubscription:
      currentSubscription && currentSubscription.planId
        ? {
            planId: currentSubscription.planId,
            status: currentSubscription.status,
            Plan: currentSubscription.Plan
              ? {
                  name: currentSubscription.Plan.name,
                  id: currentSubscription.Plan.id,
                }
              : undefined,
          }
        : null,
  };
}
