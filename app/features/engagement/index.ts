/**
 * Engagement Feature Public API
 * 
 * This module exports the public API for engagement-related operations.
 * Internal implementation details are kept in services/, hooks/, and components/ directories.
 * 
 * Usage:
 *   import { getEngagementData, getMutedList } from "~/features/engagement";
 * 
 * Do NOT import from internal paths like:
 *   import { ... } from "~/features/engagement/services/..."  // ❌ Bad
 *   import { ... } from "~/features/engagement/hooks/..."    // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  EngagementData,
  NotificationItem,
} from "./types";

// ============================================================================
// Engagement Data
// ============================================================================

export {
  getEngagementData,
} from "./engagement.server";

// ============================================================================
// Muted List
// ============================================================================

export {
  getMutedList,
  updateMutedList,
} from "./mutedList.server";

// ============================================================================
// Engagement Loader
// ============================================================================

export {
  loadEngagementData,
} from "./services/engagement-loader.server";

// ============================================================================
// Trust Score
// ============================================================================

export {
  calculateTrustScore,
} from "./trustScore";




