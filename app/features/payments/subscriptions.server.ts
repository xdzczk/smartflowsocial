import { redirect } from "@remix-run/node";

import {
  ensureUserHasFreePlan,
  getUserSubscription,
} from "~/features/payments/data";
import { parseCommercialPlanType } from "~/features/payments/plan-mapping";
import { deriveBillingContext } from "~/features/payments/services/subscription-status.server";
import { getUserById } from "~/features/user";
import { logWarning } from "~/lib/error-logger.server";

export { ensureUserHasFreePlan } from "~/features/payments/data";

import type { FeatureName, SubscriptionData } from "./types";
import { hasFeatureAccess } from "./types";

/**
 * Load the free-plan fallback and the subscription shown in the dashboard.
 * Disabled accounts stay on the dashboard and see the downgraded billing banner.
 * The app root sends signed-in users to `/dashboard`, so a redirect back to `/`
 * would loop.
 */
async function ensureFreeAndGetSubscriptionData(
  userId: string
): Promise<SubscriptionData> {
  await ensureUserHasFreePlan(userId);
  return getSubscriptionData(userId);
}

/**
 * Ensure user has at least a free subscription and access to the feature.
 * Redirects to /plans when the user does not have access (e.g. expired subscription = free plan).
 * "Dashboard" access is never gated - we always return data so expired users can land on dashboard.
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
}

/**
 * Ensure user has at least a free subscription; return subscription data for dashboard shell.
 * Does not require a paid plan. If a paid plan has expired, UI shows an expired banner.
 */
export async function requireDashboardSubscriptionContext(
  userId: string
): Promise<SubscriptionData> {
  return ensureFreeAndGetSubscriptionData(userId);
}

/** @deprecated Use `requireDashboardSubscriptionContext` (name reflects behavior). */
export const requireActiveSubscription = requireDashboardSubscriptionContext;

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

  let billingContext: SubscriptionData["billingContext"];
  if (user && currentSubscription) {
    billingContext = deriveBillingContext({
      user: {
        id: user.id,
        isEnabled: user.isEnabled,
        npub: user.npub,
        nwcEnabled: user.nwcEnabled,
        encryptedNwc: user.encryptedNwc,
      },
      subscription: {
        planId: currentSubscription.planId,
        status: currentSubscription.status,
        paymentMethod: currentSubscription.paymentMethod,
        renewalMode: currentSubscription.renewalMode,
        cancelAtPeriodEnd: currentSubscription.cancelAtPeriodEnd,
        currentPeriodEnd: currentSubscription.currentPeriodEnd,
        gracePeriodEndsAt: currentSubscription.gracePeriodEndsAt,
        Plan: currentSubscription.Plan,
      },
    });
  }

  return {
    user: user ? { id: userId, isEnabled: user.isEnabled } : null,
    currentSubscription: currentSubscription?.planId
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
    billingContext,
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
  if (subscription?.status !== "ACTIVE") {
    return false;
  }
  const commercialPlanType = parseCommercialPlanType(
    subscription.planId ?? subscription.Plan?.id ?? subscription.Plan?.name
  );
  if (!commercialPlanType) {
    logWarning("Invalid subscription plan id for gating", {
      userId,
      planId: subscription.planId ?? null,
      planName: subscription.Plan?.name ?? null,
    });
    return false;
  }
  if (commercialPlanType === "free") {
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
