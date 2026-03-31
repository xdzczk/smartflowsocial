import { useMatches } from "@remix-run/react";

import {
  getPlanEntitlements,
  type PlanEntitlements,
} from "~/features/payments/entitlements/plan-entitlements";
import {
  getCommercialPlanDisplayName,
  mapLegacyPlanIdToCommercialPlanType,
} from "~/features/payments/plan-mapping";
import {
  getCanonicalPlanPolicy,
  toBroadcastLimits,
  toGiveawayLimits,
} from "~/features/payments/plan-policy";
import type { BillingContext } from "~/features/payments/types/subscription-billing.types";

// Define feature permissions for each plan type (surface / route access).
// Execution limits (schedule cap, bulk send, broadcast send) use getPlanEntitlements.
export const PLAN_FEATURES = {
  free: {
    basicScheduling: true,
    newPost: true,
    dashboard: true,
    drafts: true,
    calendar: true,
    bulkScheduling: true,
    longformPosts: true,
    templates: true,
    recyclables: true,
    scheduled: true,
    posted: true,
    published: true,
    giveaways: true,
    contests: true,
    settings: true,
    engagement_feed: true,
    broadcasts: true,
  },
  basic: {
    basicScheduling: true,
    newPost: true,
    dashboard: true,
    drafts: true,
    calendar: true,
    bulkScheduling: true,
    longformPosts: true,
    templates: true,
    recyclables: true,
    scheduled: true,
    posted: true,
    published: true,
    giveaways: true,
    contests: true,
    settings: true,
    engagement_feed: true,
    broadcasts: true,
  },
  premium: {
    basicScheduling: true,
    newPost: true,
    dashboard: true,
    drafts: true,
    calendar: true,
    bulkScheduling: true,
    longformPosts: true,
    templates: true,
    recyclables: true,
    scheduled: true,
    posted: true,
    published: true,
    giveaways: true,
    contests: true,
    settings: true,
    engagement_feed: true,
    broadcasts: true,
  },
  pro: {
    basicScheduling: true,
    newPost: true,
    dashboard: true,
    drafts: true,
    calendar: true,
    bulkScheduling: true,
    longformPosts: true,
    templates: true,
    recyclables: true,
    scheduled: true,
    posted: true,
    published: true,
    giveaways: true,
    contests: true,
    settings: true,
    engagement_feed: true,
    broadcasts: true,
  },
  enterprise: {
    basicScheduling: true,
    newPost: true,
    dashboard: true,
    drafts: true,
    calendar: true,
    bulkScheduling: true,
    longformPosts: true,
    templates: true,
    recyclables: true,
    scheduled: true,
    posted: true,
    published: true,
    giveaways: true,
    contests: true,
    settings: true,
    engagement_feed: true,
    broadcasts: true,
  },
  /** Future tier; not sold yet — browse-all + same execution caps as free. */
  teams: {
    basicScheduling: true,
    newPost: true,
    dashboard: true,
    drafts: true,
    calendar: true,
    bulkScheduling: true,
    longformPosts: true,
    templates: true,
    recyclables: true,
    scheduled: true,
    posted: true,
    published: true,
    giveaways: true,
    contests: true,
    settings: true,
    engagement_feed: true,
    broadcasts: true,
  },
  /** Lifetime / early-supporter tier: same entitlements as premium for product gates */
  founder: {
    basicScheduling: true,
    newPost: true,
    dashboard: true,
    drafts: true,
    calendar: true,
    bulkScheduling: true,
    longformPosts: true,
    templates: true,
    recyclables: true,
    scheduled: true,
    posted: true,
    published: true,
    giveaways: true,
    contests: true,
    settings: true,
    engagement_feed: true,
    broadcasts: true,
  },
} as const;

/** Audience sources allowed for broadcast recipient resolution */
export type BroadcastAudienceGate = "CUSTOM" | "MUTUALS";

/**
 * Tier limits for Broadcasts. Free/teams: no send; paid: tiered caps.
 */
export function getBroadcastPlanLimits(planType: PlanType): {
  maxRecipientsPerCampaign: number;
  maxConcurrentActiveCampaigns: number;
  maxDailyBroadcastRecipients: number;
  allowedAudienceTypes: BroadcastAudienceGate[];
  allowAdvancedDelivery: boolean;
  allowSchedule: boolean;
  allowStaggered: boolean;
} {
  const commercialPlanType = mapLegacyPlanIdToCommercialPlanType(planType);
  const policy = getCanonicalPlanPolicy(commercialPlanType);
  return toBroadcastLimits(policy);
}

export type PlanType = keyof typeof PLAN_FEATURES;
export type FeatureName = keyof typeof PLAN_FEATURES.free;

export interface UserSubscription {
  planId: string;
  status: string;
  /** Date or ISO string (after Remix loader JSON serialization) */
  currentPeriodEnd?: Date | string | null;
  Plan?: {
    name: string;
    id: string;
    enableLifetimeAccess?: boolean;
  };
}

export interface SubscriptionData {
  user: {
    id: string;
    isEnabled: boolean;
  } | null;
  currentSubscription: UserSubscription | null;
  /** Derived billing UX (NWC vs manual, grace, banners). Server-only from loaders. */
  billingContext?: BillingContext | null;
}

/**
 * Returns true if the subscription is within its paid period (or lifetime).
 * Used so expired paid plans are treated as free for feature access.
 */
function isSubscriptionWithinPeriod(subscription: UserSubscription): boolean {
  if (subscription.Plan?.enableLifetimeAccess) {
    return true;
  }
  const periodEnd = subscription.currentPeriodEnd;
  if (periodEnd == null || periodEnd === "") {
    return true;
  }
  return new Date(periodEnd) >= new Date();
}

/**
 * Returns true when the subscription is ACTIVE but the billing period has ended.
 * Used for UI (e.g. "expired" banner) and for isSubscriptionExpired in dashboard.
 */
export function isSubscriptionPeriodExpired(
  subscription: UserSubscription | null
): boolean {
  if (subscription?.status !== "ACTIVE") {
    return false;
  }
  return !isSubscriptionWithinPeriod(subscription);
}

/**
 * Get the current user's plan type from their subscription.
 * When the billing period has ended, returns "free" so premium features are gated.
 */
export function getUserPlanType(
  subscription: UserSubscription | null
): PlanType {
  if (subscription?.status !== "ACTIVE") {
    return "free";
  }
  if (!isSubscriptionWithinPeriod(subscription)) {
    return "free";
  }

  // Check both plan name and planId for better matching
  const planName = subscription.Plan?.name.toLowerCase() ?? "";
  const planId = subscription.planId.toLowerCase();

  // Check planId first (more reliable), then plan name
  if (planId === "basic" || planName.includes("basic")) {
    return "basic";
  }
  if (planId === "founder" || planName.includes("founder")) {
    return "founder";
  }
  if (planId === "premium" || planName.includes("premium")) return "premium";
  if (planId === "pro" || planName.includes("pro")) return "pro";
  if (planId === "enterprise" || planName.includes("enterprise"))
    return "enterprise";
  if (planId === "teams" || planName.includes("teams")) return "teams";

  return "free";
}

/**
 * Check if a user has access to a specific feature
 */
export function hasFeatureAccess(
  subscription: UserSubscription | null,
  feature: FeatureName
): boolean {
  const planType = getUserPlanType(subscription);
  return PLAN_FEATURES[planType][feature];
}

/**
 * Get subscription information from the current route's loader data
 * This looks for subscription data in the current route or parent routes
 */
export function useSubscription(): SubscriptionData | null {
  const matches = useMatches();

  // Prefer a match that includes currentSubscription; fall back to a match that only has user
  let foundUser: { id: string; isEnabled: boolean } | null = null;
  let foundSub: UserSubscription | null = null;

  for (let i = matches.length - 1; i >= 0; i--) {
    const match = matches[i];
    const data = match?.data as
      | {
          user?: { id: string; isEnabled: boolean };
          currentSubscription?: UserSubscription;
        }
      | undefined;
    if (!data || typeof data !== "object") continue;

    if (!foundSub && data.currentSubscription) {
      foundSub = data.currentSubscription;
    }
    if (!foundUser && data.user) {
      foundUser = data.user;
    }

    if (foundSub && foundUser) break;
  }

  if (foundUser || foundSub) {
    return {
      user: foundUser ?? null,
      currentSubscription: foundSub ?? null,
    };
  }

  return null;
}

/**
 * Hook to check if current user has access to a specific feature
 */
export function useFeatureAccess(feature: FeatureName): boolean {
  const subscriptionData = useSubscription();
  return hasFeatureAccess(
    subscriptionData?.currentSubscription ?? null,
    feature
  );
}

/**
 * Hook to determine if the current user has any subscription record at all.
 * Useful for gating access to dashboard child routes in the UI.
 */
export function useHasAnySubscription(): boolean {
  const subscriptionData = useSubscription();
  return !!subscriptionData?.currentSubscription;
}

/**
 * Hook to get the current user's plan type
 */
export function usePlanType(): PlanType {
  const subscriptionData = useSubscription();
  return getUserPlanType(subscriptionData?.currentSubscription ?? null);
}

export type { PlanEntitlements };

/**
 * Hook: execution limits and capabilities for the current user (from plan tier).
 */
export function usePlanEntitlements(): PlanEntitlements {
  return getPlanEntitlements(usePlanType());
}

export { getPlanEntitlements };

/**
 * Giveaway plan limits (Option A: single giveaways flag, tier gates advanced).
 * Free: basic scope (PERIOD/SINGLE_POST), low winner cap, no presets.
 * Paid (basic+): QUEUE scope, higher cap, presets.
 */
export function getGiveawayPlanLimits(planType: PlanType): {
  maxWinnerCount: number;
  canUseQueueScope: boolean;
  canUsePresets: boolean;
} {
  const commercialPlanType = mapLegacyPlanIdToCommercialPlanType(planType);
  const policy = getCanonicalPlanPolicy(commercialPlanType);
  return toGiveawayLimits(policy);
}

/** Display label for subscription plan (giveaway finalization UI). */
export function getPlanDisplayName(
  subscription: UserSubscription | null
): string {
  if (subscription?.status !== "ACTIVE") {
    return "Free";
  }
  const commercial = mapLegacyPlanIdToCommercialPlanType(subscription.planId);
  return getCommercialPlanDisplayName(commercial);
}

/**
 * Get the minimum plan required for a feature (upgrade prompts).
 * Browse surfaces are on Free; paid execution (bulk, broadcast send) starts at Creator.
 */
export function getMinimumPlanForFeature(feature: FeatureName): PlanType {
  if (feature === "bulkScheduling" || feature === "broadcasts") {
    return "basic";
  }
  // PLAN_FEATURES currently marks all surface features true on every tier; paid execution uses getPlanEntitlements.
  return "free";
}

/**
 * Check if user is a new user without any subscription
 */
export function isNewUserWithoutSubscription(
  subscriptionData: SubscriptionData | null
): boolean {
  if (!subscriptionData?.user) {
    return true; // No user data means not logged in
  }

  // User exists but has no active subscription
  return subscriptionData.currentSubscription?.status !== "ACTIVE";
}

/**
 * Parameters for creating an invoice
 */
export interface CreateInvoiceParams {
  planId: string;
  userId: string;
  description?: string;
  /** Override amount (USD) for priced SKUs (yearly/prepay). Defaults to Plan.price. */
  amountUsdOverride?: number;
  billingCadence?: "monthly" | "yearly";
  accessDurationMonths?: number;
  billingPaymentMethod?:
    | "nwc_auto_renew"
    | "lightning_one_time"
    | "btc_btcpay_onchain";
}

/** Lightning bolt11 vs BTCPay hosted checkout URL */
export type InvoiceCheckoutKind = "lightning" | "btcpay";

/**
 * Invoice response from payment creation
 */
export interface InvoiceResponse {
  invoice: string;
  paymentHash: string;
  amount: number;
  amountUsd: number;
  expiresAt: Date;
  paymentId: string;
  planName?: string;
  planId?: string;
  /** BTCPay checkout link flow vs Lightning bolt11 */
  checkoutKind?: InvoiceCheckoutKind;
}

/**
 * Parameters for creating a renewal payment
 */
export interface CreateRenewalPaymentParams {
  paymentId: string;
  userId: string;
  amount: number;
  amountUsd: number;
  invoice: string;
  paymentHash: string;
  description: string;
}
