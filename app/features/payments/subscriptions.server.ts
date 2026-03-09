import { redirect } from "@remix-run/node";

import { getUserById } from "~/features/user";
import {
  ensureUserHasFreePlan,
  getUserSubscription,
} from "~/models/payment.server";

export { ensureUserHasFreePlan } from "~/models/payment.server";

import type { FeatureName, SubscriptionData } from "./types";
import { hasFeatureAccess } from "./types";

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
 * Ensure user has at least a free subscription and access to the feature.
 * Redirects to /plans when the user does not have access (e.g. expired subscription = free plan).
 * "Dashboard" access is never gated—we always return data so expired users can land on dashboard.
 */
export async function requireFeatureAccess(
  userId: string,
  feature: FeatureName
): Promise<SubscriptionData> {
  const data = await ensureFreeAndGetSubscriptionData(userId);
  if (feature === "dashboard") {
    return data;
  }
  if (!hasFeatureAccess(data.currentSubscription, feature)) {
    throw redirect("/plans");
  }
  return data;
}

/**
 * Ensure user has at least a free subscription. Never redirects to /plans.
 */
export async function requireAnySubscription(userId: string): Promise<void> {
  await ensureUserHasFreePlan(userId);

  const user = await getUserById(userId);
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
  const [user, currentSubscription] = await Promise.all([
    getUserById(userId),
    getUserSubscription(userId),
  ]);

  return {
    user: user ? { id: userId, isEnabled: user.isEnabled } : null,
    currentSubscription:
      currentSubscription && currentSubscription.planId
        ? {
            planId: currentSubscription.planId,
            status: currentSubscription.status,
            currentPeriodEnd: currentSubscription.currentPeriodEnd ?? undefined,
            Plan: currentSubscription.Plan
              ? {
                  name: currentSubscription.Plan.name,
                  id: currentSubscription.Plan.id,
                  enableLifetimeAccess: currentSubscription.Plan
                    .enableLifetimeAccess
                    ? true
                    : undefined,
                }
              : undefined,
          }
        : null,
  };
}

/**
 * Returns true if the user has an active subscription that is within the current
 * billing period (or has lifetime access). Used by Blossom subscription gating
 * so expired paid plans are treated as inactive even if status is still ACTIVE.
 */
export async function isSubscriptionActiveForGating(
  userId: string
): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription || subscription.status !== "ACTIVE") {
    return false;
  }
  if (subscription.Plan?.enableLifetimeAccess) {
    return true;
  }
  if (!subscription.currentPeriodEnd) {
    return true;
  }
  return new Date(subscription.currentPeriodEnd) >= new Date();
}
