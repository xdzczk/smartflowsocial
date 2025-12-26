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
 *   import { ... } from "~/features/giveaway/hooks/..."  // ❌ Bad
 *   import { ... } from "~/features/giveaway/components/..."  // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  RelatedEvent,
  GiveawayProfile,
  GiveawayStats,
  PrimalEvent,
} from "./types";

// ============================================================================
// Giveaway Data
// ============================================================================

// Note: getGiveawayData and handleGiveawayAction don't exist in giveaway.server.ts
// They may need to be implemented or these exports should be removed
// For now, we'll export loadGiveawayData which does exist

// ============================================================================
// Giveaway Loader
// ============================================================================

export {
  loadGiveawayData,
} from "./giveaway-loader.server";

