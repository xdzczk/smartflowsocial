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
  GiveawayPost,
  GiveawayFilter,
} from "./types";

// ============================================================================
// Giveaway Data
// ============================================================================

export {
  getGiveawayData,
  handleGiveawayAction,
} from "./giveaway.server";

// ============================================================================
// Giveaway Loader
// ============================================================================

export {
  loadGiveawayData,
} from "./giveaway-loader.server";

