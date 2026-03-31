import type { BillingNotificationCommMode } from "~/features/payments/types/subscription-billing.types";

export type { BillingNotificationCommMode };
export type { SubscriptionBillingPaymentMethod } from "~/features/payments/types/subscription-billing.types";

/** All billing DM / lifecycle event types (V2 spec). */
export const SUBSCRIPTION_NOTIFICATION_EVENT_TYPES = [
  "subscription_expired",
  "subscription_downgraded_to_free",
  "renewal_upcoming_3d",
  "renewal_upcoming_24h",
  "renewal_success",
  "renewal_failed",
  "grace_period_started",
  "grace_period_ending_24h",
  "nwc_action_required",
  "topup_reminder_7d",
  "topup_reminder_3d",
  "topup_reminder_24h",
] as const;

export type SubscriptionNotificationEventType =
  (typeof SUBSCRIPTION_NOTIFICATION_EVENT_TYPES)[number];

export function isSubscriptionNotificationEventType(
  value: string
): value is SubscriptionNotificationEventType {
  return (SUBSCRIPTION_NOTIFICATION_EVENT_TYPES as readonly string[]).includes(
    value
  );
}

export interface NotificationIntent {
  eventType: SubscriptionNotificationEventType;
  dedupeKey: string;
  commMode: BillingNotificationCommMode;
}
