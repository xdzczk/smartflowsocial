/**
 * Plans loader data preparation
 * Centralized data fetching for plans page
 */

import { requireUser } from "~/features/auth/session.server";
import {
  countActiveSubscriptionsForPlan,
  getAllPlans,
  getUserSubscription,
  listActivePlanPricesForPlans,
  PlanBillingModel,
} from "~/features/payments/data";
import { isSubscriptionPeriodExpired } from "~/features/payments/types";
import type {
  FounderOfferingPayload,
  PricingPagePlan,
} from "~/features/payments/types/plan-loader.types";
import { yearlySavingsLabel } from "~/features/payments/types/plan-loader.types";
import { getUserNWC } from "~/features/user";
import { featureFlags } from "~/lib/feature-flags.server";

const GRID_CALLOUTS: Record<string, string[]> = {
  free: [
    "Calendar, engagement, drafts, and templates",
    "Up to 10 scheduled items",
    "1 queue included",
    "Explore broadcasts and run campaigns",
  ],
  basic: [
    "Higher scheduling and queue limits",
    "Bulk workflow access",
    "Broadcast sending",
    "Better campaign economics",
  ],
  premium: [
    "Highest limits across workflows",
    "Best campaign economics",
    "Strongest publishing control",
    "Built for power users",
  ],
  teams: [
    "Shared workflows",
    "Multi-user publishing",
    "Role-based operations",
    "Team-grade controls",
  ],
};

const FOUNDER_BENEFITS = [
  "Lifetime access — non-recurring",
  "Top individual-tier economics",
  "Priority support",
  "Early access to major features",
  "Best campaign / finalization economics",
  "Founder recognition",
];

const PLAN_SUBTITLES: Record<string, string> = {
  free: "Full surface, tight limits",
  basic: "Serious solo workflow",
  premium: "Operate at full power",
  teams: "Built for collaborative publishing",
};

function toBillingModelString(
  m: PlanBillingModel
): PricingPagePlan["planBillingModel"] {
  switch (m) {
    case PlanBillingModel.free:
      return "free";
    case PlanBillingModel.recurring:
      return "recurring";
    case PlanBillingModel.lifetime:
      return "lifetime";
    case PlanBillingModel.disabled:
      return "disabled";
    default:
      return "recurring";
  }
}

function buildCheckoutPricing(
  planId: string,
  monthlyAutoRenewUsd: number,
  yearlyAutoRenewUsd: number,
  priceIndex: Map<string, number>
): PricingPagePlan["checkoutPricing"] {
  const lightning1 =
    priceIndex.get(`${planId}:monthly:1:lightning_one_time`) ??
    monthlyAutoRenewUsd;
  const lightning3 =
    priceIndex.get(`${planId}:monthly:3:lightning_one_time`) ??
    monthlyAutoRenewUsd * 3;
  const lightning6 =
    priceIndex.get(`${planId}:monthly:6:lightning_one_time`) ??
    monthlyAutoRenewUsd * 6;
  const lightningYearly =
    priceIndex.get(`${planId}:yearly:12:lightning_one_time`) ??
    yearlyAutoRenewUsd;
  const btcOnchainYearly =
    priceIndex.get(`${planId}:yearly:12:btc_btcpay_onchain`) ?? null;

  return {
    nwcAutoRenewMonthlyUsd: monthlyAutoRenewUsd,
    nwcAutoRenewYearlyUsd: yearlyAutoRenewUsd,
    lightningOneTimeMonthlyUsd: {
      1: lightning1,
      3: lightning3,
      6: lightning6,
    },
    lightningOneTimeYearlyUsd: lightningYearly,
    btcOnchainYearlyUsd: btcOnchainYearly,
  };
}

function mapPlanFeatures(plan: {
  features: unknown;
  enableBasicScheduling: boolean;
  enableMultipleQueues: boolean;
  enableBulkScheduling: boolean;
  enableRepostsAndQuotes: boolean;
  enableEngagementFeed: boolean;
  enableGiveaways: boolean;
  enableCommissions: boolean;
  enableLeaderboards: boolean;
  enableAdvancedAnalytics: boolean;
  enableMultiAccountSwitching: boolean;
  enableWolfFilteringAndVortex: boolean;
  enableNativeS3BlossomStorage: boolean;
  enableRelayBlast: boolean;
  enableVisualPerks: boolean;
  enableLifetimeAccess: boolean;
}): Record<string, boolean | string> {
  const features = plan.features as Record<string, boolean | string> | null;
  return {
    basicScheduling:
      features?.["basicScheduling"] ?? plan.enableBasicScheduling,
    multipleQueues: features?.["multipleQueues"] ?? plan.enableMultipleQueues,
    bulkScheduling: features?.["bulkScheduling"] ?? plan.enableBulkScheduling,
    repostsAndQuotes:
      features?.["repostsAndQuotes"] ?? plan.enableRepostsAndQuotes,
    engagementFeed: features?.["engagementFeed"] ?? plan.enableEngagementFeed,
    giveaways: features?.["giveaways"] ?? plan.enableGiveaways,
    commissions:
      features?.["commissions"] ?? (plan.enableCommissions ? "Low" : "High"),
    leaderboards: features?.["leaderboards"] ?? plan.enableLeaderboards,
    advancedAnalytics:
      features?.["advancedAnalytics"] ?? plan.enableAdvancedAnalytics,
    multiAccountSwitching:
      features?.["multiAccountSwitching"] ?? plan.enableMultiAccountSwitching,
    wolfFilteringAndVortex:
      features?.["wolfFilteringAndVortex"] ?? plan.enableWolfFilteringAndVortex,
    nativeS3BlossomStorage:
      features?.["nativeS3BlossomStorage"] ?? plan.enableNativeS3BlossomStorage,
    relayBlast: features?.["relayBlast"] ?? plan.enableRelayBlast,
    visualPerks: features?.["visualPerks"] ?? plan.enableVisualPerks,
    lifetimeAccess: features?.["lifetimeAccess"] ?? plan.enableLifetimeAccess,
  };
}

/**
 * Load plans data
 */
export async function loadPlansData(request: Request) {
  let user = null;
  let currentSubscription = null;
  let nwc: {
    enabled: boolean;
    maskedString?: string;
    lastUsed?: Date | null;
  } | null = null;

  try {
    user = await requireUser(request);
    currentSubscription = await getUserSubscription(user.id);
    nwc = await getUserNWC(user.id);
  } catch {
    // User not logged in - that's okay for viewing plans
  }

  const dbPlans = await getAllPlans();
  const visiblePlans = dbPlans.filter((p) => p.visibleOnPricingPage);

  const founderPlan = visiblePlans.find(
    (p) =>
      p.isSpecialOffering && p.planBillingModel === PlanBillingModel.lifetime
  );

  const mainGridSource = visiblePlans.filter(
    (p) =>
      !p.isSpecialOffering && p.planBillingModel !== PlanBillingModel.lifetime
  );

  const planIdsForPrices = [
    ...new Set(
      visiblePlans
        .filter(
          (p) =>
            p.planBillingModel === PlanBillingModel.recurring ||
            p.planBillingModel === PlanBillingModel.lifetime
        )
        .map((p) => p.id)
    ),
  ];

  const planPrices = await listActivePlanPricesForPlans(planIdsForPrices);
  const priceIndex = new Map<string, number>();
  for (const row of planPrices) {
    const key = `${row.planId}:${row.billingCadence}:${row.accessDurationMonths}:${row.paymentMethod}`;
    priceIndex.set(key, row.priceUsd);
  }

  let seatsClaimed = 0;
  if (founderPlan?.founderSeatCap != null) {
    seatsClaimed = await countActiveSubscriptionsForPlan(founderPlan.id);
  }

  const mapToPricingPagePlan = (plan: (typeof dbPlans)[0]): PricingPagePlan => {
    const features = mapPlanFeatures(plan);
    const isTeams = plan.id === "teams";
    const isRecurring = plan.planBillingModel === PlanBillingModel.recurring;

    let monthlyPriceUsd = 0;
    let yearlyPriceUsd = 0;
    let yearlySavingsNote: string | null = null;
    let checkoutPricing = buildCheckoutPricing(plan.id, 0, 0, priceIndex);

    if (isRecurring) {
      monthlyPriceUsd =
        priceIndex.get(`${plan.id}:monthly:1:nwc_auto_renew`) ??
        Number(plan.price);
      yearlyPriceUsd =
        priceIndex.get(`${plan.id}:yearly:12:nwc_auto_renew`) ??
        monthlyPriceUsd * 12;
      yearlySavingsNote = yearlySavingsLabel(monthlyPriceUsd, yearlyPriceUsd);
      checkoutPricing = buildCheckoutPricing(
        plan.id,
        monthlyPriceUsd,
        yearlyPriceUsd,
        priceIndex
      );
    }

    const subtitle = PLAN_SUBTITLES[plan.id] ?? plan.description ?? "";

    return {
      id: plan.id,
      name: plan.name,
      monthlyPriceUsd,
      yearlyPriceUsd,
      yearlySavingsNote,
      checkoutPricing,
      description: subtitle,
      features,
      isPopular: plan.id === "basic",
      planBillingModel: toBillingModelString(plan.planBillingModel),
      purchasable: plan.purchasable,
      isComingSoon: plan.isComingSoon,
      isTeamsPlaceholder: isTeams,
      callouts: GRID_CALLOUTS[plan.id] ?? [],
    };
  };

  const mainGridPlans: PricingPagePlan[] = mainGridSource.map((plan) =>
    mapToPricingPagePlan(plan)
  );

  // Always show the Teams card on the pricing page, even if the DB visibility
  // configuration is out of sync in some environments.
  const hasTeamsInGrid = mainGridPlans.some((p) => p.id === "teams");
  if (!hasTeamsInGrid) {
    mainGridPlans.push({
      id: "teams",
      name: "Teams",
      monthlyPriceUsd: 0,
      yearlyPriceUsd: 0,
      yearlySavingsNote: null,
      checkoutPricing: buildCheckoutPricing("teams", 0, 0, priceIndex),
      description:
        PLAN_SUBTITLES["teams"] ?? "Built for collaborative publishing",
      features: {},
      isPopular: false,
      planBillingModel: "disabled",
      purchasable: false,
      isComingSoon: true,
      isTeamsPlaceholder: true,
      callouts: GRID_CALLOUTS["teams"] ?? [],
    });
  }

  // Enforce canonical ordering in the main grid.
  const gridOrder = ["free", "basic", "premium", "teams"] as const;
  mainGridPlans.sort((a, b) => {
    const ai = gridOrder.indexOf(a.id as (typeof gridOrder)[number]);
    const bi = gridOrder.indexOf(b.id as (typeof gridOrder)[number]);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const comparisonTablePlans: PricingPagePlan[] = mainGridPlans;

  let founderOffering: FounderOfferingPayload | null = null;
  if (founderPlan?.founderSeatCap != null) {
    const cap = founderPlan.founderSeatCap;
    const remaining = Math.max(0, cap - seatsClaimed);
    const once = Number(founderPlan.price);
    const founderMonthlyNwc =
      priceIndex.get(`${founderPlan.id}:monthly:1:nwc_auto_renew`) ?? once;
    const founderYearlyNwc =
      priceIndex.get(`${founderPlan.id}:yearly:12:nwc_auto_renew`) ?? once;
    founderOffering = {
      id: founderPlan.id,
      name: founderPlan.name,
      description: founderPlan.description ?? "",
      oneTimePriceUsd: once,
      seatCap: cap,
      seatsClaimed,
      seatsRemaining: remaining,
      canPurchase: founderPlan.purchasable && remaining > 0,
      benefits: FOUNDER_BENEFITS,
      features: mapPlanFeatures(founderPlan),
      checkoutPricing: buildCheckoutPricing(
        founderPlan.id,
        founderMonthlyNwc,
        founderYearlyNwc,
        priceIndex
      ),
    };
  }

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
    mainGridPlans,
    comparisonTablePlans,
    founderOffering,
    user: user ? { id: user.id, isEnabled: user.isEnabled } : null,
    nwc: user ? nwc : null,
    subscriptionCheckoutV2Enabled: featureFlags.subscriptionCheckoutV2Enabled,
    btcpayYearlyOnChainEnabled: true,
    billingCadences: ["monthly", "yearly"] as const,
    manualDurationsByCadence: {
      monthly: [1, 3, 6],
      yearly: [12],
    } as const,
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
