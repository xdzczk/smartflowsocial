/**
 * Posts Feature Server-Side API
 *
 * This module exports server-only functions and types.
 * Use this import path for loaders, actions, and server-side services.
 *
 * Usage:
 *   import { getScheduledDashboardData, loadDashboardData } from "~/features/posts/server";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./services/..."  // ❌ Bad
 */

// ============================================================================
// Types (re-exported for server-side usage)
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
  QueueType,
  UserData,
  HashTagPreset,
  PostFetcher,
  PreparedEvent,
} from "./types";

// DTOs (Data Transfer Objects) for serialized data
export type { PostDTO, LongFormPostDTO } from "./dtos";
export {
  toPostDTO,
  toPostDTOArray,
  fromPostDTO,
  fromPostDTOArray,
  toLongFormPostDTO,
  toLongFormPostDTOArray,
  fromLongFormPostDTO,
  fromLongFormPostDTOArray,
} from "./dtos";

// Re-export Prisma types for convenience (when needed for type annotations)
export type { LongFormPost as LongFormPostType } from "@prisma/client";

export { convertJsonValueToScheduleConfig } from "./types";

// ============================================================================
// Core Business Logic - Dashboard Data
// ============================================================================

// Scheduled Posts
export {
  getScheduledDashboardData,
  handleScheduledPostAction,
} from "./services/scheduled-posts.server";
export { handleScheduledAction } from "./services/scheduled-action.server";

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

export { calculateNextScheduleTime } from "./schedulers";

// ============================================================================
// Post Actions
// ============================================================================

export { postedPostsAction } from "./posted.action.server";

// ============================================================================
// Bulk Posts Handlers
// ============================================================================

// Re-export all bulk post handlers for convenience
// @deprecated Import directly from handlers/ subdirectory for better tree-shaking
export { handleFileChange } from "./handlers/file-upload.handler";
export {
  handleCaptionChange,
  handleDateChange,
  handleRemovePost,
} from "./handlers/post-state.handler";
export {
  handleIsRecyclableChange,
  handleBulkRecyclableToggle,
} from "./handlers/recyclable.handler";
export { handleScheduleIntervalClick } from "./handlers/schedule-interval.handler";
export { updateDisplayedHashtags } from "./handlers/hashtag.handler";
export {
  handleQueueTypeChange,
  handleBulkQueueUpdate,
} from "./handlers/queue-type.handler";

// ============================================================================
// Post Statistics
// ============================================================================

export { getPostStats } from "./stats.server";

// ============================================================================
// Content Utilities
// ============================================================================

export { combineContent, postToCombinedContent } from "./combined.server";

// ============================================================================
// Post Filtering
// ============================================================================

export {
  filterPostsByQueueType,
  filterPostsArraysByQueueType,
} from "./services/post-filtering.server";

// ============================================================================
// Dashboard Services (Loaders)
// ============================================================================

export { loadDashboardData } from "./services/dashboard-loader.server";

export { handleDashboardAction } from "./services/dashboard-action.server";

export { loadDraftsData } from "./services/drafts-loader.server";
export { handleDraftsAction } from "./services/drafts-action.server";

export { loadScheduledData } from "./services/scheduled-loader.server";

// ============================================================================
// Draft Services
// ============================================================================

export { loadDraftEditData } from "./services/draft-edit-loader.server";

export { handleDraftEditAction } from "./services/draft-edit-action.server";

// ============================================================================
// Long Form Services
// ============================================================================

export { loadLongFormEditData } from "./services/longform-edit-loader.server";

export { handleLongFormEditAction } from "./services/longform-edit-action.server";

export { loadNewLongFormData } from "./services/newlongform-loader.server";

export { handleNewLongFormAction } from "./services/newlongform-action.server";

// ============================================================================
// New Post Services
// ============================================================================

export { loadNewPostData } from "./services/newpost-loader.server";

export { handleNewPostAction } from "./services/newpost-action.server";

// ============================================================================
// Queue Type Resolver
// ============================================================================

export { resolveQueueTypeId } from "./services/queue-type-resolver.server";

// ============================================================================
// Long Form Status Calculator
// ============================================================================

export { calculateLongFormStatus } from "./services/longform-status-calculator.server";

// ============================================================================
// Calendar Services
// ============================================================================

export { handleCalendarAction } from "./services/calendar-action.server";
export {
  loadCalendarData,
  loadCalendarQueueData,
} from "./services/calendar-loader.server";

// ============================================================================
// API Services
// ============================================================================

export {
  getEffectiveHashtags,
  parseEffectiveHashtagsRequest,
} from "./services/effective-hashtags.server";

export {
  getBatchPosts,
  parseBatchPostsRequest,
} from "./services/batch-posts.server";

export {
  calculateQueueScheduleTime,
  parseQueueScheduleRequest,
} from "./services/queue-schedule.server";

// ============================================================================
// Calendar Utilities
// ============================================================================

export {
  postsToCalendarPosts,
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
} from "./utils/calendar-post-converter";
