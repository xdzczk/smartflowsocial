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
 *   import { ... } from "./services/..."  // ❌ Bad
 *   import { ... } from "./hooks/..."    // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  EngagementData,
  NotificationItem,
  GroupedNotification,
  EventStats,
} from "./types";

// ============================================================================
// Engagement Data
// ============================================================================

export { getEngagementData } from "./engagement.server";

// ============================================================================
// Muted List
// ============================================================================

export { getMutedList } from "./mutedList.server";

// ============================================================================
// Engagement Loader
// ============================================================================

export { ENGAGEMENT_FEED_PAGE_SIZE } from "./constants";
export {
  loadEngagementData,
  loadEngagementFeedData,
} from "./services/engagement-loader.server";

// ============================================================================
// Trust Score
// ============================================================================

export { calculateTrustScore } from "./trust-score";

// ============================================================================
// Components (Public API)
// ============================================================================

export { MutedListSettings } from "./components/MutedListSettings";
export { EngagementContent } from "./components/EngagementContent";
export { EngagementHeader } from "./components/EngagementHeader";
export { EngagementTabs } from "./components/EngagementTabs";
export { default as EngagementFeedPage } from "./components/EngagementFeedPage";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { useEngagementState } from "./hooks/useEngagementState";
export {
  useEngagementQuery,
  useEngagementData,
  useEngagementInfiniteQuery,
  useEngagementInfiniteData,
  engagementKeys,
} from "./hooks/useEngagementQuery";
export type { EngagementLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
