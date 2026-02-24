/**
 * Plans loader data preparation
 * Centralized data fetching for plans page
 */

import { requireUser } from "~/features/auth/session.server";
import { isSubscriptionPeriodExpired } from "~/features/payments/types";
import { getAllPlans, getUserSubscription } from "~/models/payment.server";

/**
 * Load plans data
 */
export async function loadPlansData(request: Request) {
  // Get user if logged in (optional for viewing plans)
  let user = null;
  let currentSubscription = null;

  try {
    user = await requireUser(request);
    currentSubscription = await getUserSubscription(user.id);
  } catch {
    // User not logged in - that's okay for viewing plans
  }

  // Fetch plans from database
  const dbPlans = await getAllPlans();

  // Transform database plans to match the frontend format
  const plans = dbPlans.map((plan) => {
    const features = plan.features as Record<string, boolean> | null;
    const price = Number(plan.price);
    const period =
      price === 0
        ? ""
        : plan.enableLifetimeAccess
          ? "one payment"
          : "per month";

    return {
      id: plan.id,
      name: plan.name,
      price,
      period,
      description: plan.description ?? "",
      features: {
        basicScheduling:
          features?.["basicScheduling"] ?? plan.enableBasicScheduling,
        multipleQueues:
          features?.["multipleQueues"] ?? plan.enableMultipleQueues,
        bulkScheduling:
          features?.["bulkScheduling"] ?? plan.enableBulkScheduling,
        repostsAndQuotes:
          features?.["repostsAndQuotes"] ?? plan.enableRepostsAndQuotes,
        engagementFeed:
          features?.["engagementFeed"] ?? plan.enableEngagementFeed,
        giveaways: features?.["giveaways"] ?? plan.enableGiveaways,
        commissions:
          features?.["commissions"] ??
          (plan.enableCommissions ? "Low" : "High"),
        leaderboards: features?.["leaderboards"] ?? plan.enableLeaderboards,
        advancedAnalytics:
          features?.["advancedAnalytics"] ?? plan.enableAdvancedAnalytics,
        multiAccountSwitching:
          features?.["multiAccountSwitching"] ??
          plan.enableMultiAccountSwitching,
        wolfFilteringAndVortex:
          features?.["wolfFilteringAndVortex"] ??
          plan.enableWolfFilteringAndVortex,
        nativeS3BlossomStorage:
          features?.["nativeS3BlossomStorage"] ??
          plan.enableNativeS3BlossomStorage,
        relayBlast: features?.["relayBlast"] ?? plan.enableRelayBlast,
        visualPerks: features?.["visualPerks"] ?? plan.enableVisualPerks,
        lifetimeAccess:
          features?.["lifetimeAccess"] ?? plan.enableLifetimeAccess,
      },
      isPopular: plan.id === "basic", // You can make this dynamic based on your business logic
    };
  });

  const isExpired =
    currentSubscription != null
      ? isSubscriptionPeriodExpired({
          planId: currentSubscription.planId ?? "",
          status: currentSubscription.status as string,
          currentPeriodEnd: currentSubscription.currentPeriodEnd,
          Plan: currentSubscription.Plan
            ? {
                name: currentSubscription.Plan.name,
                id: currentSubscription.Plan.id,
                enableLifetimeAccess:
                  currentSubscription.Plan.enableLifetimeAccess,
              }
            : undefined,
        })
      : false;

  return {
    plans,
    user: user ? { id: user.id, isEnabled: user.isEnabled } : null,
    currentSubscription: currentSubscription
      ? {
          planId: currentSubscription.planId,
          status: currentSubscription.status,
          plan: currentSubscription.Plan?.name,
          isExpired,
        }
      : null,
  };
}
