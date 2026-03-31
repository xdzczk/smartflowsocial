import { format } from "date-fns";

import type { BillingNotificationCommMode } from "~/features/payments/types/subscription-billing.types";

import type { SubscriptionNotificationEventType } from "./subscription-notification-types";

function formatEnd(date: Date): string {
  return format(date, "dd MMM yyyy");
}

export function buildSubscriptionNotificationMessage(params: {
  eventType: SubscriptionNotificationEventType;
  commMode: BillingNotificationCommMode;
  /** Period end for renewal / top-up copy */
  currentPeriodEnd: Date | null;
  /** Grace end when relevant */
  gracePeriodEndsAt: Date | null;
}): string {
  const { eventType, commMode, currentPeriodEnd, gracePeriodEndsAt } = params;
  const endStr = currentPeriodEnd ? formatEnd(currentPeriodEnd) : "soon";
  const graceStr = gracePeriodEndsAt ? formatEnd(gracePeriodEndsAt) : endStr;

  if (commMode === "MANUAL_TOP_UP") {
    return buildManualCopy(eventType, endStr, graceStr);
  }
  return buildNwcCopy(eventType, endStr, graceStr);
}

function buildManualCopy(
  eventType: SubscriptionNotificationEventType,
  endStr: string,
  graceStr: string
): string {
  switch (eventType) {
    case "topup_reminder_7d":
      return [
        "Your SmartFlowSocial paid period ends in 7 days.",
        "Auto-renew is not enabled on this account. Top up your subscription now if you want uninterrupted access.",
        "",
        "This account uses manual top-ups, not auto-renew. If you want uninterrupted access, extend your subscription before it ends.",
      ].join("\n");
    case "topup_reminder_3d":
      return `Your SmartFlowSocial paid period ends in 3 days.\nTo keep your plan active without interruption, top up before ${endStr}.`;
    case "topup_reminder_24h":
      return `Your SmartFlowSocial paid period ends in about 24 hours.\nTop up now to avoid downgrade to Free.`;
    case "subscription_expired":
      return `Your SmartFlowSocial paid period has ended.\nYour account will remain on Free unless you top up your subscription.`;
    case "subscription_downgraded_to_free":
      return `Your SmartFlowSocial account is now on the Free plan.\nTop up any time to restore paid features.`;
    case "renewal_success":
      return `Your SmartFlowSocial plan is active until ${endStr}.`;
    case "grace_period_started":
    case "grace_period_ending_24h":
    case "renewal_failed":
    case "renewal_upcoming_3d":
    case "renewal_upcoming_24h":
    case "nwc_action_required":
      // Not used for manual mode
      return buildManualFallback(eventType, endStr, graceStr);
    default:
      return buildManualFallback(eventType, endStr, graceStr);
  }
}

function buildManualFallback(
  eventType: string,
  endStr: string,
  graceStr: string
): string {
  return `SmartFlowSocial billing update (${eventType}). Paid period context: ${endStr}. Grace: ${graceStr}.`;
}

function buildNwcCopy(
  eventType: SubscriptionNotificationEventType,
  endStr: string,
  graceStr: string
): string {
  switch (eventType) {
    case "renewal_upcoming_3d":
      return [
        "Your SmartFlowSocial subscription renews in 3 days.",
        "Auto-renew is enabled via NWC. Make sure your wallet connection and balance are ready so your plan continues without interruption.",
      ].join("\n");
    case "renewal_upcoming_24h":
      return [
        "Your SmartFlowSocial subscription renews in about 24 hours.",
        "Auto-renew will be attempted via NWC. Check that your wallet is connected and has enough balance.",
      ].join("\n");
    case "renewal_success":
      return `Subscription renewed successfully.\nYour SmartFlowSocial plan is active until ${endStr}.`;
    case "renewal_failed":
      return [
        "We could not renew your SmartFlowSocial subscription via NWC.",
        "Your plan has entered grace period. Reconnect your wallet or top up manually to avoid downgrade.",
      ].join("\n");
    case "grace_period_started":
      return `Your subscription is now in grace period.\nFix NWC or top up manually before ${graceStr} to keep paid features active.`;
    case "grace_period_ending_24h":
      return `Your grace period ends in about 24 hours.\nReconnect NWC or top up now to avoid downgrade to Free.`;
    case "subscription_downgraded_to_free":
      return `Your SmartFlowSocial subscription has been downgraded to Free.\nTop up any time to restore paid features.`;
    case "nwc_action_required":
      return [
        "Action needed: your SmartFlowSocial subscription is set to auto-renew via NWC, but your wallet connection is missing or invalid.",
        "Reconnect NWC under Billing settings so renewal can run.",
      ].join("\n");
    case "subscription_expired":
      return `Your SmartFlowSocial subscription period has ended.\nReconnect NWC or top up to restore paid access.`;
    default:
      return `SmartFlowSocial billing update (${eventType}). Renewal context: ${endStr}.`;
  }
}
