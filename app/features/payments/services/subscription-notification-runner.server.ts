import { findUsersForBillingNotifications } from "~/features/payments/repositories/subscription-notification.repository.server";
import { deliverSubscriptionNotificationDm } from "~/features/payments/services/subscription-notification-delivery.server";
import { computeDueNotificationIntents } from "~/features/payments/services/subscription-notification-policy.server";

export interface SubscriptionNotificationRunResult {
  usersScanned: number;
  intentsProcessed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Pre-expiry + grace + recent-expiry DMs (cron phase 1).
 */
export async function runSubscriptionNotifications(
  nowInput?: Date
): Promise<SubscriptionNotificationRunResult> {
  const now = nowInput ?? new Date();
  const result: SubscriptionNotificationRunResult = {
    usersScanned: 0,
    intentsProcessed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const users = await findUsersForBillingNotifications(now);
  result.usersScanned = users.length;

  for (const user of users) {
    const sub = user.Subscription;
    if (!sub?.Plan || sub.Plan.enableLifetimeAccess) {
      continue;
    }

    try {
      const intents = computeDueNotificationIntents({
        now,
        user: {
          nwcEnabled: user.nwcEnabled,
          encryptedNwc: user.encryptedNwc,
        },
        subscription: {
          id: sub.id,
          planId: sub.planId,
          status: sub.status,
          paymentMethod: sub.paymentMethod,
          renewalMode: sub.renewalMode,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          currentPeriodStart: sub.currentPeriodStart,
          currentPeriodEnd: sub.currentPeriodEnd,
          gracePeriodEndsAt: sub.gracePeriodEndsAt,
          Plan: sub.Plan,
        },
      });

      for (const intent of intents) {
        result.intentsProcessed++;
        const r = await deliverSubscriptionNotificationDm({
          userId: user.id,
          npub: user.npub,
          subscriptionId: sub.id,
          planId: sub.planId,
          eventType: intent.eventType,
          commMode: intent.commMode,
          dedupeKey: intent.dedupeKey,
          currentPeriodEnd: sub.currentPeriodEnd,
          gracePeriodEndsAt: sub.gracePeriodEndsAt,
        });
        if (r.skipped) {
          result.skipped++;
        } else if (r.ok) {
          result.sent++;
        } else {
          result.failed++;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`user ${user.id}: ${msg}`);
    }
  }

  return result;
}
