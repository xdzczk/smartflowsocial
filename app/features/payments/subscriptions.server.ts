import { redirect } from "@remix-run/node";

import {
  hasFeatureAccess,
  isNewUserWithoutSubscription,
  type FeatureName,
  type SubscriptionData,
} from "~/features/payments/types";
import { prisma } from "~/lib/prisma.server";
import { getUserSubscription } from "~/models/payment.server";

/**
 * Check if a user has access to a specific feature and redirect if not
 */
export async function requireFeatureAccess(
  userId: string,
  feature: FeatureName,
  redirectTo = "/plans",
): Promise<SubscriptionData> {
  // Get user's enabled status and subscription
  const [user, currentSubscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isEnabled: true },
    }),
    getUserSubscription(userId),
  ]);

  // Check if user exists and is enabled
  if (!user || !user.isEnabled) {
    throw redirect(redirectTo);
  }

  const subscriptionData: SubscriptionData = {
    user: { id: userId, isEnabled: user.isEnabled },
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

  // Check if user has access to the feature
  if (!hasFeatureAccess(subscriptionData.currentSubscription, feature)) {
    throw redirect(redirectTo);
  }

  return subscriptionData;
}

/**
 * Check if user is new without subscription and redirect if accessing restricted routes
 */
export async function checkNewUserAccess(
  userId: string,
  redirectTo = "/plans",
): Promise<SubscriptionData> {
  // Get user's enabled status and subscription
  const [user, currentSubscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isEnabled: true },
    }),
    getUserSubscription(userId),
  ]);

  // Check if user exists and is enabled
  if (!user || !user.isEnabled) {
    throw redirect(redirectTo);
  }

  const subscriptionData: SubscriptionData = {
    user: { id: userId, isEnabled: user.isEnabled },
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

  // Check if user is new without subscription
  if (isNewUserWithoutSubscription(subscriptionData)) {
    throw redirect(redirectTo);
  }

  return subscriptionData;
}

/**
 * Require that the user has any subscription; if the current request is for a
 * dashboard child route and the user has no subscription, redirect to /plans.
 *
 * A "dashboard child" is any path that starts with "/dashboard/" (note the trailing slash).
 */
export async function requireSubscriptionForDashboardChild(
  request: Request,
  userId: string,
  redirectTo = "/plans",
): Promise<SubscriptionData> {
  const subscriptionData = await getSubscriptionData(userId);

  // Check if user exists and is enabled
  if (!subscriptionData.user || !subscriptionData.user.isEnabled) {
    throw redirect(redirectTo);
  }

  const url = new URL(request.url);
  const pathname = url.pathname;
  const isDashboardChild =
    pathname !== "/dashboard" && pathname.startsWith("/dashboard");

  if (isDashboardChild && !subscriptionData.currentSubscription) {
    throw redirect(redirectTo);
  }

  return subscriptionData;
}

/**
 * Require that the user has any subscription; if not, redirect to /plans.
 */
export async function requireAnySubscription(
  userId: string,
  redirectTo = "/plans",
): Promise<void> {
  // Get user's enabled status and subscription
  const [user, currentSubscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isEnabled: true },
    }),
    getUserSubscription(userId),
  ]);

  // Check if user exists and is enabled
  if (!user || !user.isEnabled) {
    throw redirect(redirectTo);
  }

  if (!currentSubscription) {
    throw redirect(redirectTo);
  }
}

/**
 * Require that the user has an ACTIVE subscription; otherwise redirect to /plans.
 * Returns subscription data for convenience.
 */
export async function requireActiveSubscription(
  userId: string,
  redirectTo = "/plans",
): Promise<SubscriptionData> {
  // Get user's enabled status and subscription
  const [user, currentSubscription] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isEnabled: true },
    }),
    getUserSubscription(userId),
  ]);

  // Check if user exists and is enabled
  if (!user || !user.isEnabled) {
    throw redirect(redirectTo);
  }

  const subscriptionData: SubscriptionData = {
    user: { id: userId, isEnabled: user.isEnabled },
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

  if (
    !subscriptionData.currentSubscription ||
    subscriptionData.currentSubscription.status !== "ACTIVE"
  ) {
    throw redirect(redirectTo);
  }

  return subscriptionData;
}

/**
 * Get subscription data without enforcing access (for informational purposes)
 */
export async function getSubscriptionData(
  userId: string,
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
