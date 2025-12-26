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
 *   import { ... } from "~/features/payments/services/..."  // ❌ Bad
 *   import { ... } from "~/features/payments/hooks/..."      // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  PlanType,
  FeatureName,
  UserSubscription,
  SubscriptionData,
} from "./types";

// ============================================================================
// Plan Features & Access Control
// ============================================================================

export {
  PLAN_FEATURES,
  getUserPlanType,
  hasFeatureAccess,
} from "./types";

// ============================================================================
// Subscription Management
// ============================================================================

export {
  requireFeatureAccess,
  getSubscriptionData,
} from "./subscriptions.server";

export {
  isNewUserWithoutSubscription,
} from "./types";

// ============================================================================
// Plans Actions & Loaders
// ============================================================================

export {
  handlePlansAction,
} from "./services/plans-action.server";

export {
  loadPlansData,
} from "./services/plans-loader.server";

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

export {
  getBitcoinRate,
} from "./btc.rate";

