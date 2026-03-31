import {
  buildGraceDedupeKey,
  buildSubscriptionDedupeKey,
} from "~/features/payments/repositories/subscription-notification.repository.server";
import {
  deriveBillingCommMode,
  needsNwcActionRequired,
} from "~/features/payments/services/subscription-status.server";
import {
  getUserPlanType,
  type UserSubscription,
} from "~/features/payments/types";
import type {
  BillingNotificationCommMode,
  SubscriptionBillingPaymentMethod,
} from "~/features/payments/types/subscription-billing.types";

import type {
  NotificationIntent,
  SubscriptionNotificationEventType,
} from "./subscription-notification-types";

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

function toUserSubscription(sub: {
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
 * Non-overlapping windows before period end: 7d (optional), 3d, 24h.
 */
/* eslint-disable sonarjs/cognitive-complexity -- explicit event windows per spec */
export function computeDueNotificationIntents(params: {
  now: Date;
  user: {
    nwcEnabled: boolean;
    encryptedNwc: string | null;
  };
  subscription: {
    id: string;
    planId: string | null;
    status: string;
    paymentMethod: SubscriptionBillingPaymentMethod;
    renewalMode: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    gracePeriodEndsAt: Date | null;
    Plan: { name: string; id: string; enableLifetimeAccess?: boolean } | null;
  };
}): NotificationIntent[] {
  const { now, user, subscription: sub } = params;
  const intents: NotificationIntent[] = [];

  if (!sub.planId || !sub.Plan || sub.Plan.enableLifetimeAccess) {
    return intents;
  }

  const us = toUserSubscription(sub);
  if (!us) return intents;

  const planType = getUserPlanType(us);
  if (planType === "free") {
    return intents;
  }

  const commMode: BillingNotificationCommMode = deriveBillingCommMode(
    user,
    sub
  );
  const periodEnd = sub.currentPeriodEnd;
  if (!periodEnd) {
    return intents;
  }

  const msUntilEnd = periodEnd.getTime() - now.getTime();
  const periodStart = sub.currentPeriodStart;
  const periodLengthMs = periodStart
    ? periodEnd.getTime() - periodStart.getTime()
    : MS_DAY * 30;

  // Upcoming period reminders (only while period still active)
  if (msUntilEnd > 0) {
    if (needsNwcActionRequired({ subscription: sub, user })) {
      intents.push({
        eventType: "nwc_action_required",
        dedupeKey: buildSubscriptionDedupeKey(
          "nwc_action_required",
          sub.id,
          periodEnd
        ),
        commMode: "AUTO_RENEW_NWC",
      });
    }

    if (commMode === "AUTO_RENEW_NWC") {
      if (msUntilEnd <= 3 * MS_DAY && msUntilEnd > 24 * MS_HOUR) {
        intents.push({
          eventType: "renewal_upcoming_3d",
          dedupeKey: buildSubscriptionDedupeKey(
            "renewal_upcoming_3d",
            sub.id,
            periodEnd
          ),
          commMode,
        });
      } else if (msUntilEnd <= 24 * MS_HOUR && msUntilEnd > 0) {
        intents.push({
          eventType: "renewal_upcoming_24h",
          dedupeKey: buildSubscriptionDedupeKey(
            "renewal_upcoming_24h",
            sub.id,
            periodEnd
          ),
          commMode,
        });
      }
    } else {
      const allow7d = periodLengthMs >= 7 * MS_DAY - MS_HOUR;
      if (allow7d && msUntilEnd <= 7 * MS_DAY && msUntilEnd > 3 * MS_DAY) {
        intents.push({
          eventType: "topup_reminder_7d",
          dedupeKey: buildSubscriptionDedupeKey(
            "topup_reminder_7d",
            sub.id,
            periodEnd
          ),
          commMode,
        });
      } else if (msUntilEnd <= 3 * MS_DAY && msUntilEnd > 24 * MS_HOUR) {
        intents.push({
          eventType: "topup_reminder_3d",
          dedupeKey: buildSubscriptionDedupeKey(
            "topup_reminder_3d",
            sub.id,
            periodEnd
          ),
          commMode,
        });
      } else if (msUntilEnd <= 24 * MS_HOUR && msUntilEnd > 0) {
        intents.push({
          eventType: "topup_reminder_24h",
          dedupeKey: buildSubscriptionDedupeKey(
            "topup_reminder_24h",
            sub.id,
            periodEnd
          ),
          commMode,
        });
      }
    }
  }

  // Grace period (after period end, while grace active)
  const graceEnd = sub.gracePeriodEndsAt;
  if (graceEnd && graceEnd > now && periodEnd < now) {
    const msUntilGraceEnd = graceEnd.getTime() - now.getTime();
    if (commMode === "AUTO_RENEW_NWC") {
      intents.push({
        eventType: "grace_period_started",
        dedupeKey: buildGraceDedupeKey(
          "grace_period_started",
          sub.id,
          graceEnd
        ),
        commMode,
      });
    }
    if (
      commMode === "AUTO_RENEW_NWC" &&
      msUntilGraceEnd <= 24 * MS_HOUR &&
      msUntilGraceEnd > 0
    ) {
      intents.push({
        eventType: "grace_period_ending_24h",
        dedupeKey: buildGraceDedupeKey(
          "grace_period_ending_24h",
          sub.id,
          graceEnd
        ),
        commMode,
      });
    }
  }

  // Paid period ended (manual): first window after expiry
  if (
    msUntilEnd <= 0 &&
    msUntilEnd > -3 * MS_DAY &&
    commMode === "MANUAL_TOP_UP"
  ) {
    intents.push({
      eventType: "subscription_expired",
      dedupeKey: buildSubscriptionDedupeKey(
        "subscription_expired",
        sub.id,
        periodEnd
      ),
      commMode,
    });
  }

  return dedupeIntentsByType(intents);
}
/* eslint-enable sonarjs/cognitive-complexity */

function dedupeIntentsByType(
  intents: NotificationIntent[]
): NotificationIntent[] {
  const seen = new Set<string>();
  const out: NotificationIntent[] = [];
  for (const i of intents) {
    const k = `${i.eventType}:${i.dedupeKey}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(i);
  }
  return out;
}

export function singleEventIntent(
  eventType: SubscriptionNotificationEventType,
  params: {
    subscriptionId: string;
    periodAnchor: Date;
    commMode: BillingNotificationCommMode;
  }
): NotificationIntent {
  return {
    eventType,
    dedupeKey: buildSubscriptionDedupeKey(
      eventType,
      params.subscriptionId,
      params.periodAnchor
    ),
    commMode: params.commMode,
  };
}
