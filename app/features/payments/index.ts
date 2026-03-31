/**
 * Payments Feature Public API
 *
 * This module exports the public API for payment and subscription-related operations.
 * Internal implementation details are kept in services/, hooks/, and components/ directories.
 *
 * Usage:
 *   import { getUserPlanType, hasFeatureAccess, requireFeatureAccess } from "~/features/payments";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./services/..."  // ❌ Bad
 *   import { ... } from "./hooks/..."      // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  PlanType,
  FeatureName,
  UserSubscription,
  SubscriptionData,
  BroadcastAudienceGate,
  PlanEntitlements,
} from "./types";

// ============================================================================
// Plan Features & Access Control
// ============================================================================

export {
  PLAN_FEATURES,
  getGiveawayPlanLimits,
  getBroadcastPlanLimits,
  getPlanEntitlements,
  getUserPlanType,
  getPlanDisplayName,
  hasFeatureAccess,
  isSubscriptionPeriodExpired,
  usePlanEntitlements,
} from "./types";

// ============================================================================
// Subscription Management
// ============================================================================

export {
  ensureUserHasFreePlan,
  requireFeatureAccess,
  requireAnySubscription,
  requireActiveSubscription,
  requireDashboardSubscriptionContext,
  getSubscriptionData,
  isSubscriptionActiveForGating,
} from "./subscriptions.server";

export { isNewUserWithoutSubscription } from "./types";

// ============================================================================
// Plans Actions & Loaders
// ============================================================================

export { handlePlansAction } from "./services/plans-action.server";

export { loadPlansData } from "./services/plans-loader.server";

// ============================================================================
// NWC (Nostr Wallet Connect)
// ============================================================================
// Note: NWC functions are not yet implemented - these exports are commented out
// export {
//   createInvoice,
//   checkPaymentStatus,
//   requestPayment,
// } from "./nwc.server";

// ============================================================================
// Bitcoin Rate
// ============================================================================

export { getBitcoinRate } from "./btc.rate";

// ============================================================================
// Payment Status
// ============================================================================

export {
  checkPaymentStatusById,
  getPaymentUserId,
} from "./services/payment-status.server";

export { checkAndRenewSubscriptions } from "./services/subscription-renewal.server";
export { runCampaignPayoutAutorunCron } from "./services/campaign-payout-cron.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { NWCSettings } from "./components/NWCSettings";
export { SubscriptionSettings } from "./components/SubscriptionSettings";
export {
  BillingAlertBanner,
  BillingStatusCard,
} from "./components/billing/BillingSurfaces";
export { ErrorMessage } from "./components/ErrorMessage";
export { FeatureComparisonTable } from "./components/FeatureComparisonTable";
export { InvoiceModal } from "./components/InvoiceModal";
export { PaymentSuccessModal } from "./components/PaymentSuccessModal";
export { PricingCard } from "./components/PricingCard";
export {
  SubscriptionCheckoutModal,
  defaultCheckoutPaymentMethod,
} from "./components/SubscriptionCheckoutModal";
export { PlansPage } from "./components/PlansPage";
export { PlanStatusBanner } from "./components/PlanStatusBanner";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { usePlansState } from "./hooks/usePlansState";
