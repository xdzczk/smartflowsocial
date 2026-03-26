/**
 * Giveaway Feature Public API
 *
 * This module exports the public API for giveaway-related operations.
 * Internal implementation details are kept in hooks/ and components/ directories.
 *
 * Usage:
 *   import { loadGiveawayData, handleGiveawayAction } from "~/features/giveaway";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./hooks/..."  // ❌ Bad
 *   import { ... } from "./components/..."  // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  EngagementTypeConfig,
  GiveawayEngagementConfig,
  GiveawayWinnerEntry,
  PrimalEvent,
  RelatedEvent,
  GiveawayProfile,
  GiveawayStats,
} from "./types";

// ============================================================================
// Giveaway Data
// ============================================================================

// Note: getGiveawayData and handleGiveawayAction don't exist in giveaway.server.ts
// They may need to be implemented or these exports should be removed
// For now, we'll export loadGiveawayData which does exist

// ============================================================================
// Giveaway Loader & Actions
// ============================================================================

export { loadGiveawayData } from "./giveaway-loader.server";
export {
  getGiveawayById,
  previewGiveaway,
  rerollGiveaway,
  excludeWinnerAndRedraw,
  lockGiveaway,
  cancelGiveaway,
  deleteGiveaway,
  markGiveawayPaidOut,
  setGiveawayWinnerPayoutStatus,
  runGiveawayPayoutBatchWithNwc,
  runGiveawayPayoutBatchStepWithNwc,
  updateGiveawayPayoutSettings,
  duplicateGiveaway,
  resetGiveawayToDraft,
  updateGiveaway,
  appendGiveawayAuditActivity,
} from "./giveaway-actions.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { GiveawayBlacklistSettings } from "./components/GiveawayBlacklistSettings";
export { GiveawayDetailPage } from "./components/GiveawayDetailPage";
export { GiveawayFilters } from "./components/GiveawayFilters";
export { GiveawayQueueTabs } from "./components/GiveawayQueueTabs";
export { default as GiveawayRandomizer } from "./components/GiveawayRandomizer";
export { GiveawayTable } from "./components/GiveawayTable";
export { default as GiveawayPage } from "./components/GiveawayPage";
export type { GiveawayPageProps } from "./components/GiveawayPage";
export { GiveawayNewBuilder } from "./components/GiveawayNewBuilder";
export { default as GiveawayQueuePage } from "./components/GiveawayQueuePage";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { useGiveawayState } from "./hooks/useGiveawayState";
export {
  useGiveawayQuery,
  useGiveawayData,
  giveawayKeys,
} from "./hooks/useGiveawayQuery";
export type { GiveawayLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
