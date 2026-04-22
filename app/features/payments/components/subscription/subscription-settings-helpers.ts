import { format } from "date-fns";

import type { Subscription } from "./subscription-settings-types";

/**
 * Display status for the UI: show EXPIRED when the billing period has ended
 * even if the DB still has status ACTIVE.
 */
export function getDisplaySubscriptionStatus(
  subscription: Subscription
): string {
  if (subscription.status !== "ACTIVE") {
    return subscription.status;
  }
  if (subscription.plan?.enableLifetimeAccess) {
    return "ACTIVE";
  }
  const periodEnd =
    subscription.currentPeriodEnd ?? subscription.nextPaymentDue;
  if (!periodEnd) {
    return "ACTIVE";
  }
  if (new Date(periodEnd) < new Date()) {
    return "EXPIRED";
  }
  return "ACTIVE";
}

export function getStatusColor(status: string) {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "text-success bg-success/20 dark:text-success dark:bg-success/20/20";
    case "EXPIRED":
      return "text-danger bg-danger/10 dark:text-danger dark:bg-danger/20/20";
    case "CANCELED":
      return "text-danger bg-danger/10 dark:text-danger dark:bg-danger/20/20";
    case "PAST_DUE":
      return "text-warning-text bg-warning/12 dark:text-text dark:bg-surface-hover";
    case "INACTIVE":
      return "text-text bg-surface-hover dark:text-text-secondary dark:bg-surface/20";
    default:
      return "text-text bg-surface-hover dark:text-text-secondary dark:bg-surface/20";
  }
}

export function formatSubscriptionDate(date: Date | null) {
  if (!date) return "N/A";
  return format(new Date(date), "dd MMM yyyy");
}

export function formatSubscriptionDateTime(date: Date | null) {
  if (!date) return "N/A";
  return format(new Date(date), "dd MMM yyyy 'at' h:mm a");
}

export function formatRenewalMode(mode: string | undefined) {
  if (mode === "auto_renew") return "Auto-renew";
  if (mode === "manual") return "Manual";
  return "Manual";
}

export function formatCadence(cadence: string | undefined) {
  if (cadence === "yearly") return "Yearly";
  if (cadence === "monthly") return "Monthly";
  return "Monthly";
}

export function formatBillingPaymentMethod(method: string | undefined) {
  if (method === "nwc_auto_renew") return "Connected wallet (auto-renew)";
  if (method === "lightning_one_time") return "Manual Lightning invoice";
  if (method === "btc_btcpay_onchain") return "Bitcoin on-chain (BTCPay)";
  return "Manual Lightning invoice";
}
