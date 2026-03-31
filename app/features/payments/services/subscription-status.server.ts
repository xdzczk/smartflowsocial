import {
  getUserPlanType,
  type UserSubscription,
} from "~/features/payments/types";
import type {
  BillingContext,
  BillingNotificationCommMode,
  BillingUiStatus,
  SubscriptionBillingPaymentMethod,
} from "~/features/payments/types/subscription-billing.types";

export type { BillingContext, BillingUiStatus };

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_HOUR = 60 * 60 * 1000;

function toUserSubscriptionInput(sub: {
  planId: string | null;
  status: string;
  currentPeriodEnd: Date | null;
  Plan: { name: string; id: string; enableLifetimeAccess?: boolean } | null;
}): UserSubscription | null {
  if (!sub.planId) return null;
  return {
    planId: sub.planId,
    status: sub.status,
    currentPeriodEnd: sub.currentPeriodEnd ?? undefined,
    Plan: sub.Plan
      ? {
          name: sub.Plan.name,
          id: sub.Plan.id,
          enableLifetimeAccess: sub.Plan.enableLifetimeAccess,
        }
      : undefined,
  };
}

/**
 * Spec: AUTO_RENEW_NWC when paid plan, NWC auto-renew SKU, wallet connected, cancel not scheduled.
 */
export function deriveBillingCommMode(
  user: { nwcEnabled: boolean; encryptedNwc: string | null },
  subscription: {
    planId: string | null;
    paymentMethod: SubscriptionBillingPaymentMethod;
    renewalMode: string;
    cancelAtPeriodEnd: boolean;
    Plan: { enableLifetimeAccess?: boolean } | null;
  }
): BillingNotificationCommMode {
  if (subscription.Plan?.enableLifetimeAccess) {
    return "MANUAL_TOP_UP";
  }
  if (!subscription.planId) {
    return "MANUAL_TOP_UP";
  }
  if (subscription.cancelAtPeriodEnd) {
    return "MANUAL_TOP_UP";
  }
  if (
    subscription.paymentMethod === "nwc_auto_renew" &&
    subscription.renewalMode === "auto_renew" &&
    user.nwcEnabled &&
    Boolean(user.encryptedNwc)
  ) {
    return "AUTO_RENEW_NWC";
  }
  return "MANUAL_TOP_UP";
}

function hoursUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / MS_HOUR;
}

function daysUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / MS_DAY;
}

/* eslint-disable sonarjs/cognitive-complexity -- UI state matrix from subscription + dates */
export function deriveBillingContext(params: {
  user: {
    id: string;
    isEnabled: boolean;
    npub: string;
    nwcEnabled: boolean;
    encryptedNwc: string | null;
  };
  subscription: {
    planId: string | null;
    status: string;
    paymentMethod: SubscriptionBillingPaymentMethod;
    renewalMode: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date | null;
    gracePeriodEndsAt: Date | null;
    Plan: {
      name: string;
      id: string;
      enableLifetimeAccess?: boolean;
      price?: unknown;
    } | null;
  } | null;
  now?: Date;
}): BillingContext {
  const now = params.now ?? new Date();
  const { user, subscription } = params;

  if (!user.isEnabled) {
    return {
      commMode: "MANUAL_TOP_UP",
      uiStatus: "DOWNGRADED_FREE",
      isPaidLifecycle: false,
      paidUntil: null,
      graceEndsAt: null,
      bannerVariant: "manual_downgraded",
      primaryCta: "view_plans",
    };
  }

  if (!subscription?.planId || !subscription.Plan) {
    return {
      commMode: "MANUAL_TOP_UP",
      uiStatus: "FREE",
      isPaidLifecycle: false,
      paidUntil: null,
      graceEndsAt: null,
      bannerVariant: "none",
      primaryCta: "view_plans",
    };
  }

  const sub = subscription;
  const us = toUserSubscriptionInput(sub);
  const planType = getUserPlanType(us);
  const commModeResolved = deriveBillingCommMode(
    {
      nwcEnabled: params.user.nwcEnabled,
      encryptedNwc: params.user.encryptedNwc,
    },
    sub
  );

  if (sub.Plan?.enableLifetimeAccess) {
    return {
      commMode: "MANUAL_TOP_UP",
      uiStatus: "ACTIVE_MANUAL",
      isPaidLifecycle: true,
      paidUntil: null,
      graceEndsAt: null,
      bannerVariant: "none",
      primaryCta: "view_plans",
    };
  }

  if (planType === "free") {
    return {
      commMode: commModeResolved,
      uiStatus: "FREE",
      isPaidLifecycle: false,
      paidUntil: sub.currentPeriodEnd,
      graceEndsAt: sub.gracePeriodEndsAt,
      bannerVariant: "none",
      primaryCta: "view_plans",
    };
  }

  const periodEnd = sub.currentPeriodEnd;
  const graceEnd = sub.gracePeriodEndsAt;
  const inGrace =
    graceEnd != null &&
    graceEnd > now &&
    (sub.status === "PAST_DUE" ||
      sub.status === "UNPAID" ||
      (periodEnd != null && periodEnd < now));

  if (inGrace) {
    const gEnd = graceEnd;
    const hGrace = hoursUntil(gEnd, now);
    const graceBannerNwc =
      hGrace <= 24 && hGrace > 0
        ? "nwc_grace_ending"
        : "nwc_renewal_failed_grace";
    return {
      commMode: commModeResolved,
      uiStatus: "GRACE_PERIOD",
      isPaidLifecycle: true,
      paidUntil: periodEnd,
      graceEndsAt: gEnd,
      bannerVariant:
        commModeResolved === "AUTO_RENEW_NWC"
          ? graceBannerNwc
          : "manual_period_ending",
      primaryCta:
        commModeResolved === "AUTO_RENEW_NWC"
          ? "manage_nwc"
          : "top_up_subscription",
    };
  }

  if (periodEnd && periodEnd < now && sub.status === "ACTIVE") {
    return {
      commMode: commModeResolved,
      uiStatus: "EXPIRED",
      isPaidLifecycle: false,
      paidUntil: periodEnd,
      graceEndsAt: null,
      bannerVariant:
        commModeResolved === "MANUAL_TOP_UP"
          ? "manual_expired"
          : "nwc_downgraded",
      primaryCta:
        commModeResolved === "MANUAL_TOP_UP"
          ? "top_up_subscription"
          : "manage_nwc",
    };
  }

  if (!periodEnd) {
    return {
      commMode: commModeResolved,
      uiStatus: "ACTIVE_MANUAL",
      isPaidLifecycle: true,
      paidUntil: null,
      graceEndsAt: null,
      bannerVariant: "none",
      primaryCta:
        commModeResolved === "AUTO_RENEW_NWC"
          ? "manage_nwc"
          : "top_up_subscription",
    };
  }

  const d = daysUntil(periodEnd, now);
  const h = hoursUntil(periodEnd, now);

  if (commModeResolved === "AUTO_RENEW_NWC") {
    let uiStatus: BillingUiStatus = "ACTIVE_AUTO_RENEW";
    let bannerVariant: BillingContext["bannerVariant"] = "none";
    if (d <= 3 && d > 1) {
      uiStatus = "RENEWAL_UPCOMING";
      bannerVariant = "nwc_renewal_soon";
    } else if (h <= 24 && h > 0) {
      uiStatus = "RENEWAL_UPCOMING";
      bannerVariant = "nwc_renewal_24h";
    }
    return {
      commMode: commModeResolved,
      uiStatus,
      isPaidLifecycle: true,
      paidUntil: periodEnd,
      graceEndsAt: null,
      bannerVariant,
      primaryCta: h <= 24 ? "manage_nwc" : "manage_nwc",
    };
  }

  // Manual top-up
  let uiStatus: BillingUiStatus = "ACTIVE_MANUAL";
  let bannerVariant: BillingContext["bannerVariant"] = "none";
  if (d <= 3 && d > 1) {
    uiStatus = "TOPUP_REQUIRED_SOON";
    bannerVariant = "manual_period_ending";
  } else if (h <= 24 && h > 0) {
    uiStatus = "TOPUP_REQUIRED_SOON";
    bannerVariant = h <= 30 ? "manual_ends_tomorrow" : "manual_period_ending";
  }
  return {
    commMode: commModeResolved,
    uiStatus,
    isPaidLifecycle: true,
    paidUntil: periodEnd,
    graceEndsAt: null,
    bannerVariant,
    primaryCta: "top_up_subscription",
  };
}
/* eslint-enable sonarjs/cognitive-complexity */

/** Detect NWC configured for auto-renew but wallet disconnected (spec nwc_action_required). */
export function needsNwcActionRequired(params: {
  subscription: {
    paymentMethod: SubscriptionBillingPaymentMethod;
    renewalMode: string;
    Plan: { enableLifetimeAccess?: boolean } | null;
  };
  user: { nwcEnabled: boolean; encryptedNwc: string | null };
}): boolean {
  const { subscription, user } = params;
  if (subscription.Plan?.enableLifetimeAccess) return false;
  if (subscription.paymentMethod !== "nwc_auto_renew") return false;
  if (subscription.renewalMode !== "auto_renew") return false;
  return !user.nwcEnabled || !user.encryptedNwc;
}
