/**
 * Subscription renewal service layer
 * Handles subscription checking and automatic renewal for cron jobs
 */

import {
  createRenewalPayment,
  updateUserSubscription,
} from "~/features/payments/data";
import { getUserSubscription } from "~/features/payments/data/payment.queries.server";
import { buildSubscriptionDedupeKey } from "~/features/payments/repositories/subscription-notification.repository.server";
import { deliverSubscriptionNotificationDm } from "~/features/payments/services/subscription-notification-delivery.server";
import { runSubscriptionNotifications } from "~/features/payments/services/subscription-notification-runner.server";
import { deriveBillingCommMode } from "~/features/payments/services/subscription-status.server";
import type { SubscriptionBillingPaymentMethod } from "~/features/payments/types/subscription-billing.types";
import {
  disableUserAccount,
  getEnabledUsersWithSubscriptions,
} from "~/features/user";
import { afterSubscriptionUpdated } from "~/infra/blastr/entitlement-sync.server";
import { decrypt } from "~/lib/encryption.server";
import { createErrorResponse } from "~/lib/error-handler.server";
import { logError } from "~/lib/error-logger.server";
import { normalizeError } from "~/lib/errors";
import { trackProductEvent } from "~/lib/product-events.server";
import { ensureServerWebSocket } from "~/lib/websocket-polyfill.server";

import {
  claimSubscriptionRenewalAttempt,
  findPlanById,
  updateSubscriptionCancelAtPeriodEndAndMetadata,
  updateSubscriptionDunningState,
  updateSubscriptionToCanceled,
} from "../repositories/subscription-renewal-data.server";

import { NwcChargeError, nwcChargeFailureNotice } from "./nwc-user-pay.server";
import {
  isAutoRenewChargeEligible,
  isFreePlanPrice,
} from "./subscription-auto-renew.server";
import { chargeAutoRenewSubscription } from "./subscription-renewal-charge.server";

// ============================================================================
// Helper Functions
// ============================================================================

async function handleFreePlanRenewal(
  user: { id: string; npub: string },
  planId: string,
  _planName: string
): Promise<void> {
  const paymentId = `free_renewal_${Date.now()}_${user.id}`;
  await createRenewalPayment({
    paymentId,
    userId: user.id,
    amount: 0,
    amountUsd: 0,
    invoice: "free_plan_renewal",
    paymentHash: "free_plan_renewal",
    description: `Free plan renewal`,
  });
  await updateUserSubscription(user.id, planId, paymentId);
  const subAfter = await getUserSubscription(user.id);
  if (subAfter) {
    await deliverSubscriptionNotificationDm({
      userId: user.id,
      npub: user.npub,
      subscriptionId: subAfter.id,
      planId: subAfter.planId,
      eventType: "renewal_success",
      commMode: "MANUAL_TOP_UP",
      dedupeKey: buildSubscriptionDedupeKey(
        "renewal_success",
        subAfter.id,
        subAfter.currentPeriodEnd ?? new Date()
      ),
      currentPeriodEnd: subAfter.currentPeriodEnd,
      gracePeriodEndsAt: subAfter.gracePeriodEndsAt,
    });
  }
}

interface RenewalResults {
  checked: number;
  expired: number;
  disabled: number;
  renewalAttempted: number;
  renewalSuccess: number;
  renewalFailed: number;
  errors: string[];
  notificationSent?: number;
  notificationFailed?: number;
  notificationSkipped?: number;
  notificationIntents?: number;
}

async function notifySubscriptionDowngradedToFree(params: {
  user: {
    id: string;
    npub: string;
    nwcEnabled: boolean;
    encryptedNwc: string | null;
  };
  subscription: {
    id: string;
    planId: string | null;
    currentPeriodEnd: Date | null;
    gracePeriodEndsAt: Date | null;
    paymentMethod: SubscriptionBillingPaymentMethod;
    renewalMode: string;
    cancelAtPeriodEnd: boolean;
    Plan: { enableLifetimeAccess?: boolean } | null;
  };
}): Promise<void> {
  const { user, subscription } = params;
  const commMode = deriveBillingCommMode(user, subscription);
  const anchor =
    subscription.gracePeriodEndsAt ??
    subscription.currentPeriodEnd ??
    new Date();
  await deliverSubscriptionNotificationDm({
    userId: user.id,
    npub: user.npub,
    subscriptionId: subscription.id,
    planId: subscription.planId,
    eventType: "subscription_downgraded_to_free",
    commMode,
    dedupeKey: buildSubscriptionDedupeKey(
      "subscription_downgraded_to_free",
      subscription.id,
      anchor
    ),
    currentPeriodEnd: subscription.currentPeriodEnd,
    gracePeriodEndsAt: subscription.gracePeriodEndsAt,
  });
}

const GRACE_PERIOD_DAYS = 7;
const RETRY_DELAYS_HOURS = [0, 12, 24, 72];

// ============================================================================
// Subscription Renewal Helper Functions
// ============================================================================

function isSubscriptionExpired(subscription: {
  currentPeriodEnd: Date | null;
}): boolean {
  if (!subscription.currentPeriodEnd) {
    return false;
  }
  const now = new Date();
  return new Date(subscription.currentPeriodEnd) < now;
}

async function handleRenewalWithNWC(
  user: {
    id: string;
    npub: string;
    nwcEnabled: boolean;
    encryptedNwc: string | null;
  },
  subscription: {
    id: string;
    planId: string | null;
    plan: string | null;
    currentPeriodEnd: Date | null;
    renewalFailureCount?: number;
    gracePeriodEndsAt?: Date | null;
    nextRenewalAttemptAt?: Date | null;
    billingCadence?: "monthly" | "yearly" | null;
    paymentMethod: SubscriptionBillingPaymentMethod;
    renewalMode: string;
    cancelAtPeriodEnd: boolean;
    Plan?: {
      name: string;
      price: string;
      enableLifetimeAccess?: boolean;
    } | null;
  },
  results: RenewalResults
): Promise<void> {
  const now = new Date();
  const nextAttemptAt = subscription.nextRenewalAttemptAt ?? null;
  if (nextAttemptAt && nextAttemptAt > now) {
    return;
  }

  if (!isFreePlanPrice(subscription.Plan?.price)) {
    const claimed = await claimSubscriptionRenewalAttempt(user.id, now);
    if (!claimed) return;
  }

  results.renewalAttempted++;
  trackProductEvent("renewal_attempted", {
    userId: user.id,
    planId: subscription.planId,
  });

  try {
    if (!user.encryptedNwc) {
      throw new Error("User NWC credentials not available");
    }
    await attemptRenewal(
      { ...user, encryptedNwc: user.encryptedNwc },
      {
        id: subscription.id,
        planId: subscription.planId,
        plan: subscription.plan,
        currentPeriodEnd: subscription.currentPeriodEnd,
        Plan:
          subscription.Plan &&
          "name" in subscription.Plan &&
          "price" in subscription.Plan
            ? {
                name: String(subscription.Plan.name),
                price: String(subscription.Plan.price),
              }
            : null,
        billingCadence: subscription.billingCadence ?? "monthly",
      }
    );
    results.renewalSuccess++;
    trackProductEvent("renewal_succeeded", {
      userId: user.id,
      planId: subscription.planId,
    });
  } catch (renewalError: unknown) {
    const subNow = await getUserSubscription(user.id);
    const periodEndMs = subNow?.currentPeriodEnd
      ? new Date(subNow.currentPeriodEnd).getTime()
      : 0;
    if (periodEndMs > now.getTime()) {
      results.renewalSuccess++;
      trackProductEvent("renewal_succeeded", {
        userId: user.id,
        planId: subscription.planId,
      });
      return;
    }

    results.renewalFailed++;
    trackProductEvent("renewal_failed", {
      userId: user.id,
      planId: subscription.planId,
      error:
        renewalError instanceof Error
          ? renewalError.message
          : String(renewalError),
    });
    const errorMsg = `Failed to renew subscription for user ${user.id}: ${
      renewalError instanceof Error
        ? renewalError.message
        : String(renewalError)
    }`;
    results.errors.push(errorMsg);
    const failureDetail =
      renewalError instanceof NwcChargeError
        ? nwcChargeFailureNotice(renewalError.kind)
        : undefined;
    logError(
      renewalError instanceof Error
        ? renewalError
        : new Error(String(renewalError)),
      {
        message: `[CRON] ${errorMsg}`,
        userId: user.id,
        kind:
          renewalError instanceof NwcChargeError
            ? renewalError.kind
            : undefined,
      }
    );

    const currentFailures = Number(subscription.renewalFailureCount ?? 0);
    const newFailures = currentFailures + 1;
    const delayHours =
      RETRY_DELAYS_HOURS[
        Math.min(newFailures - 1, RETRY_DELAYS_HOURS.length - 1)
      ] ?? 0;
    const computedNextAttemptAt = new Date(
      now.getTime() + delayHours * 60 * 60 * 1000
    );
    const graceEndsAt =
      subscription.gracePeriodEndsAt ??
      new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await updateSubscriptionDunningState(user.id, {
      status: "PAST_DUE",
      renewalFailureCount: newFailures,
      lastRenewalAttemptAt: now,
      nextRenewalAttemptAt: computedNextAttemptAt,
      gracePeriodEndsAt: graceEndsAt,
    });

    // Only disable once grace period has elapsed.
    if (graceEndsAt <= now) {
      await disableUserAccount(user.id);
      await afterSubscriptionUpdated(user.id);
      results.disabled++;
      await notifySubscriptionDowngradedToFree({
        user,
        subscription: {
          id: subscription.id,
          planId: subscription.planId,
          currentPeriodEnd: subscription.currentPeriodEnd,
          gracePeriodEndsAt: graceEndsAt,
          paymentMethod: subscription.paymentMethod,
          renewalMode: subscription.renewalMode,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          Plan: subscription.Plan ?? null,
        },
      });
    }

    const periodAnchor = subscription.currentPeriodEnd ?? now;
    await deliverSubscriptionNotificationDm({
      userId: user.id,
      npub: user.npub,
      subscriptionId: subscription.id,
      planId: subscription.planId,
      eventType: "renewal_failed",
      commMode: "AUTO_RENEW_NWC",
      failureDetail,
      dedupeKey: buildSubscriptionDedupeKey(
        "renewal_failed",
        subscription.id,
        periodAnchor
      ),
      currentPeriodEnd: subscription.currentPeriodEnd,
      gracePeriodEndsAt: graceEndsAt,
    });
  }
}

async function handleRenewalWithoutNWC(
  user: {
    id: string;
    npub: string;
    nwcEnabled: boolean;
    encryptedNwc: string | null;
  },
  subscription: {
    id: string;
    planId: string | null;
    currentPeriodEnd: Date | null;
    paymentMethod: SubscriptionBillingPaymentMethod;
    renewalMode: string;
    cancelAtPeriodEnd: boolean;
    Plan?: { name: string; enableLifetimeAccess?: boolean } | null;
    gracePeriodEndsAt?: Date | null;
  },
  results: RenewalResults
): Promise<void> {
  const now = new Date();
  const graceEndsAt =
    subscription.gracePeriodEndsAt ??
    new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  await updateSubscriptionDunningState(user.id, {
    status: "UNPAID",
    renewalFailureCount: 0,
    lastRenewalAttemptAt: now,
    nextRenewalAttemptAt: null,
    gracePeriodEndsAt: graceEndsAt,
  });

  if (graceEndsAt <= now) {
    await disableUserAccount(user.id);
    await afterSubscriptionUpdated(user.id);
    results.disabled++;
    await notifySubscriptionDowngradedToFree({
      user,
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        currentPeriodEnd: subscription.currentPeriodEnd,
        gracePeriodEndsAt: graceEndsAt,
        paymentMethod: subscription.paymentMethod,
        renewalMode: subscription.renewalMode,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        Plan: subscription.Plan ?? null,
      },
    });
  }
}

function getScheduledPlanId(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }
  const scheduled = (metadata as Record<string, unknown>)["scheduledPlanId"];
  return typeof scheduled === "string" && scheduled.length > 0
    ? scheduled
    : null;
}

async function processUserSubscription(
  user: {
    id: string;
    npub: string;
    nwcEnabled: boolean;
    encryptedNwc: string | null;
    Subscription: {
      id: string;
      planId: string | null;
      plan: string | null;
      currentPeriodEnd: Date | null;
      cancelAtPeriodEnd?: boolean;
      metadata?: unknown;
      renewalFailureCount?: number;
      gracePeriodEndsAt?: Date | null;
      nextRenewalAttemptAt?: Date | null;
      billingCadence?: "monthly" | "yearly" | null;
      paymentMethod: SubscriptionBillingPaymentMethod;
      renewalMode: string;
      Plan?: {
        name: string;
        price: string;
        enableLifetimeAccess?: boolean;
      } | null;
    } | null;
  } & Record<string, unknown>,
  results: RenewalResults
): Promise<void> {
  const subscription = user.Subscription;

  if (!subscription) {
    return;
  }

  if (subscription.Plan?.enableLifetimeAccess) {
    return;
  }

  if (!isSubscriptionExpired(subscription)) {
    return;
  }

  results.expired++;

  if (subscription.cancelAtPeriodEnd) {
    const scheduledPlanId = getScheduledPlanId(subscription.metadata);

    if (scheduledPlanId) {
      const plan = await findPlanById(scheduledPlanId);
      if (plan?.isActive) {
        const paymentId = `downgrade_${Date.now()}_${user.id}`;
        await updateUserSubscription(user.id, scheduledPlanId, paymentId);
        await updateSubscriptionCancelAtPeriodEndAndMetadata(user.id, {
          cancelAtPeriodEnd: false,
          metadata: {},
        });
        return;
      }
    }

    await updateSubscriptionToCanceled(user.id, {
      status: "CANCELED",
      endDate: new Date(),
      cancelAtPeriodEnd: false,
    });
    await disableUserAccount(user.id);
    await afterSubscriptionUpdated(user.id);
    results.disabled++;
    await notifySubscriptionDowngradedToFree({
      user,
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        currentPeriodEnd: subscription.currentPeriodEnd,
        gracePeriodEndsAt: subscription.gracePeriodEndsAt ?? null,
        paymentMethod: subscription.paymentMethod,
        renewalMode: subscription.renewalMode,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
        Plan: subscription.Plan ?? null,
      },
    });
    return;
  }

  const renewalSubscription = {
    ...subscription,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
  };

  const renewWithWallet =
    (isFreePlanPrice(subscription.Plan?.price) &&
      user.nwcEnabled &&
      Boolean(user.encryptedNwc)) ||
    isAutoRenewChargeEligible({
      nwcEnabled: user.nwcEnabled,
      encryptedNwc: user.encryptedNwc,
      paymentMethod: subscription.paymentMethod,
      renewalMode: subscription.renewalMode,
    });

  if (renewWithWallet) {
    await handleRenewalWithNWC(user, renewalSubscription, results);
  } else {
    await handleRenewalWithoutNWC(user, renewalSubscription, results);
  }
}

/**
 * Check and renew subscriptions for all users
 */
export async function checkAndRenewSubscriptions(): Promise<
  {
    success: boolean;
    timestamp: string;
  } & RenewalResults
> {
  ensureServerWebSocket();
  const results: RenewalResults = {
    checked: 0,
    expired: 0,
    disabled: 0,
    renewalAttempted: 0,
    renewalSuccess: 0,
    renewalFailed: 0,
    errors: [],
  };

  try {
    const notif = await runSubscriptionNotifications();
    results.notificationSent = notif.sent;
    results.notificationFailed = notif.failed;
    results.notificationSkipped = notif.skipped;
    results.notificationIntents = notif.intentsProcessed;
    results.errors.push(...notif.errors);

    const users = await getEnabledUsersWithSubscriptions();
    results.checked = users.length;

    for (const user of users) {
      try {
        await processUserSubscription(
          user as Record<string, unknown> & {
            id: string;
            npub: string;
            nwcEnabled: boolean;
            encryptedNwc: string | null;
            Subscription: {
              id: string;
              planId: string | null;
              plan: string | null;
              currentPeriodEnd: Date | null;
              cancelAtPeriodEnd?: boolean;
              metadata?: unknown;
              paymentMethod: SubscriptionBillingPaymentMethod;
              renewalMode: string;
              gracePeriodEndsAt?: Date | null;
              nextRenewalAttemptAt?: Date | null;
              billingCadence?: "monthly" | "yearly" | null;
              Plan?: {
                name: string;
                price: string;
                enableLifetimeAccess?: boolean;
              } | null;
            } | null;
          },
          results
        );
      } catch (userError: unknown) {
        const errorMsg = `Error processing user ${user.id}: ${
          userError instanceof Error ? userError.message : String(userError)
        }`;
        results.errors.push(errorMsg);
        logError(
          userError instanceof Error ? userError : new Error(String(userError)),
          {
            message: errorMsg,
            userId: user.id,
          }
        );
      }
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      ...results,
    };
  } catch (error: unknown) {
    // Use centralized error handling but preserve results
    const normalizedError = normalizeError(error);
    const [errorResponse] = createErrorResponse(normalizedError);

    return {
      success: false,
      timestamp: new Date().toISOString(),
      ...results,
      errors: [
        ...results.errors,
        typeof errorResponse.error === "string"
          ? errorResponse.error
          : errorResponse.error.message,
      ],
    };
  }
}

/**
 * Attempt to renew a user's subscription
 */
async function attemptRenewal(
  user: { id: string; npub: string; encryptedNwc: string | null },
  subscription: {
    id: string;
    planId: string | null;
    plan: string | null;
    currentPeriodEnd: Date | null;
    Plan: { name: string; price: string } | null;
    billingCadence?: "monthly" | "yearly" | null;
  }
): Promise<void> {
  if (!user.encryptedNwc) {
    throw new Error("User NWC credentials not available");
  }
  const decryptedNwc = decrypt(user.encryptedNwc);

  const planId = subscription.planId ?? subscription.plan;
  if (!planId) {
    throw new Error("No plan ID found for subscription");
  }

  const plan = subscription.Plan;
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  if (isFreePlanPrice(plan.price)) {
    await handleFreePlanRenewal(user, planId, plan.name);
    return;
  }

  if (!subscription.currentPeriodEnd) {
    throw new Error("Subscription period end is missing");
  }

  const cadence =
    subscription.billingCadence === "yearly" ? "yearly" : "monthly";
  await chargeAutoRenewSubscription({
    userId: user.id,
    nwcUrl: decryptedNwc,
    subscriptionId: subscription.id,
    planId,
    planName: plan.name,
    planPriceUsd: Number(plan.price),
    periodEnd: new Date(subscription.currentPeriodEnd),
    billingCadence: cadence,
  });

  const subAfter = await getUserSubscription(user.id);
  if (!subAfter) return;

  const commMode = deriveBillingCommMode(
    { nwcEnabled: true, encryptedNwc: user.encryptedNwc },
    {
      planId: subAfter.planId,
      paymentMethod: subAfter.paymentMethod,
      renewalMode: subAfter.renewalMode,
      cancelAtPeriodEnd: subAfter.cancelAtPeriodEnd,
      Plan: subAfter.Plan
        ? { enableLifetimeAccess: subAfter.Plan.enableLifetimeAccess }
        : null,
    }
  );
  await deliverSubscriptionNotificationDm({
    userId: user.id,
    npub: user.npub,
    subscriptionId: subAfter.id,
    planId: subAfter.planId,
    eventType: "renewal_success",
    commMode,
    dedupeKey: buildSubscriptionDedupeKey(
      "renewal_success",
      subAfter.id,
      subAfter.currentPeriodEnd ?? new Date()
    ),
    currentPeriodEnd: subAfter.currentPeriodEnd,
    gracePeriodEndsAt: subAfter.gracePeriodEndsAt,
  });
}
