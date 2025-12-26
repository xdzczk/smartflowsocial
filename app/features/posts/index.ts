/**
 * Posts Feature Public API
 * 
 * This module exports the public API for post-related operations.
 * Internal implementation details are kept in services/, hooks/, components/, and utils/ directories.
 * 
 * Usage:
 *   import { getScheduledDashboardData, calculateNextScheduleTime } from "~/features/posts";
 * 
 * Do NOT import from internal paths like:
 *   import { ... } from "~/features/posts/services/..."  // ❌ Bad
 *   import { ... } from "~/features/posts/hooks/..."       // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  IntervalScheduleConfig,
  FixedSlotsScheduleConfig,
  ScheduleConfig,
  BulkPost,
  BulkPostsHandlerDeps,
  PostData,
  LongFormPostData,
  CombinedContent,
  PostJobData,
  EditorJSOutput,
  EditorJSAPI,
} from "./types";

// ============================================================================
// Core Business Logic - Dashboard Data
// ============================================================================

// Scheduled Posts
export {
  getScheduledDashboardData,
  handleScheduledPostAction,
} from "./services/scheduled-posts.server";

// Posted Posts
export { getPostedDashboardData } from "./services/posted-posts.server";

// Recyclable Posts
export {
  getRecyclableDashboardData,
  handleRecyclablePostAction,
} from "./services/recyclable-posts.server";

// Bulk Posts
export { getBulkPostsDashboardData } from "./services/bulk-posts.server";

// ============================================================================
// Scheduling Logic
// ============================================================================

export {
  calculateNextScheduleTime,
} from "./schedulers";

// ============================================================================
// Post Actions
// ============================================================================

export {
  postedPostsAction,
} from "./posted.action.server";

// ============================================================================
// Bulk Posts
// ============================================================================

// Re-export all bulk post handlers for convenience
export {
  handleFileChange,
  handleCaptionChange,
  handleDateChange,
  handleRemovePost,
  handleIsRecyclableChange,
  handleBulkRecyclableToggle,
  handleScheduleIntervalClick,
  updateDisplayedHashtags,
  handleQueueTypeChange,
  handleBulkQueueUpdate,
} from "./bulkposts.handlers";

// ============================================================================
// Queue Management
// ============================================================================
// Note: Queue workers are automatically started when the module is imported.
// They are managed by the queues.server.ts file and don't need explicit start/stop functions.

// ============================================================================
// Long Form Posts
// ============================================================================

export {
  getLongFormDashboardData,
} from "./longform.server";

// ============================================================================
// Post Statistics
// ============================================================================

export {
  getPostStats,
} from "./stats.server";

// ============================================================================
// Content Utilities
// ============================================================================

export {
  combineContent,
  postToCombinedContent,
} from "./combined.server";

// ============================================================================
// Post Filtering
// ============================================================================

export {
  filterPostsByQueueType,
  filterMultiplePostArraysByQueueType,
} from "./services/post-filtering.server";

// ============================================================================
// File Processing (Client-side)
// ============================================================================

export {
  isAcceptableFile,
  validateFileSizes,
  validateTotalSize,
  filterAcceptableFiles,
  processMediaFiles,
  validateAndProcessFiles,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_TOTAL_SIZE,
} from "./utils/file-processing.client";

// ============================================================================
// Queue Type Utilities
// ============================================================================

export {
  getQueueTypeColors,
} from "./queueColors";

export type {
  QueueTypeOption,
} from "./queueTypes.client";

// ============================================================================
// Dashboard Services (Loaders)
// ============================================================================

export {
  loadDashboardData,
} from "./services/dashboard-loader.server";

export {
  loadDraftsData,
} from "./services/drafts-loader.server";

export {
  loadScheduledData,
} from "./services/scheduled-loader.server";

// ============================================================================
// Draft Services
// ============================================================================

export {
  loadDraftEditData,
} from "./services/draft-edit-loader.server";

export {
  handleDraftEditAction,
} from "./services/draft-edit-action.server";

export {
  handleDraftSignAction,
} from "./services/draft-sign.server";

// ============================================================================
// Long Form Services
// ============================================================================

export {
  loadLongFormEditData,
} from "./services/longform-edit-loader.server";

export {
  handleLongFormEditAction,
} from "./services/longform-edit-action.server";

export {
  loadNewLongFormData,
} from "./services/newlongform-loader.server";

export {
  handleNewLongFormAction,
} from "./services/newlongform-action.server";

// ============================================================================
// New Post Services
// ============================================================================

export {
  loadNewPostData,
} from "./services/newpost-loader.server";

export {
  handleNewPostAction,
} from "./services/newpost-action.server";

// ============================================================================
// Queue Type Resolver
// ============================================================================

export {
  resolveQueueType,
} from "./services/queue-type-resolver.server";

// ============================================================================
// Long Form Status Calculator
// ============================================================================

export {
  calculateLongFormStatus,
} from "./services/longform-status-calculator.server";

