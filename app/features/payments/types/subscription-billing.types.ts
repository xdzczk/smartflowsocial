/** Persisted comm mode for DMs + UI (matches Prisma BillingNotificationCommMode). */
export type BillingNotificationCommMode = "AUTO_RENEW_NWC" | "MANUAL_TOP_UP";

/** Matches Prisma BillingPaymentMethod. */
export type SubscriptionBillingPaymentMethod =
  | "nwc_auto_renew"
  | "lightning_one_time"
  | "btc_btcpay_onchain";

/** Derived UI + notification routing (spec §12). */
export type BillingUiStatus =
  | "FREE"
  | "ACTIVE_AUTO_RENEW"
  | "ACTIVE_MANUAL"
  | "RENEWAL_UPCOMING"
  | "TOPUP_REQUIRED_SOON"
  | "GRACE_PERIOD"
  | "EXPIRED"
  | "DOWNGRADED_FREE";

export interface BillingContext {
  commMode: BillingNotificationCommMode;
  uiStatus: BillingUiStatus;
  isPaidLifecycle: boolean;
  paidUntil: Date | null;
  graceEndsAt: Date | null;
  bannerVariant:
    | "none"
    | "nwc_renewal_soon"
    | "nwc_renewal_24h"
    | "nwc_renewal_failed_grace"
    | "nwc_grace_ending"
    | "nwc_downgraded"
    | "manual_period_ending"
    | "manual_ends_tomorrow"
    | "manual_expired"
    | "manual_downgraded";
  primaryCta:
    | "manage_nwc"
    | "top_up_wallet"
    | "top_up_subscription"
    | "extend_plan"
    | "connect_nwc"
    | "view_plans";
}
