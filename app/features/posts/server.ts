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
export type { LongFormPost as LongFormPostType } from "./data/posts-prisma-types.server";

export { convertJsonValueToScheduleConfig } from "./types";

// ============================================================================
// Post and longform data layer (commands, queries, types)
// ============================================================================

export * from "./data/index.server";

// ============================================================================
// Core Business Logic - Dashboard Data
// ============================================================================

// Scheduled Posts (from scheduling submodule)
export {
  getScheduledDashboardData,
  handleScheduledPostAction,
  handleScheduledAction,
  loadScheduledData,
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
  calculateQueueScheduleTime,
  parseQueueScheduleRequest,
} from "./scheduling/index.server";

// Published Posts & Recyclable Posts (from publishing submodule)
export {
  getPublishedDashboardData,
  getRecyclableDashboardData,
  handleRecyclablePostAction,
  PostStateMachine,
  PublishNowUseCase,
  RecyclePostUseCase,
} from "./publishing/index.server";
export type {
  RecyclePostInput,
  RecyclePostResult,
} from "./publishing/index.server";

// Bulk Posts
export { getBulkPostsDashboardData } from "./services/bulk-posts.server";

// ============================================================================
// Scheduling Logic (re-exported from scheduling submodule above)
// ============================================================================

// ============================================================================
// Post Actions
// ============================================================================

export { publishedPostsAction } from "./published.action.server";

export {
  recordReplyPost,
  type RecordReplyPostParams,
} from "./services/record-reply-post.server";

// ============================================================================
// Bulk Posts Handlers
// ============================================================================

// Re-export all bulk post handlers for convenience
// @deprecated Import directly from handlers/ subdirectory for better tree-shaking
export {
  handleFileChange,
  processBulkSelectedFiles,
} from "./handlers/file-upload.handler";
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
export {
  getContentStatistics,
  getDraftCountForDashboard,
  getQueueCountsForDashboard,
  deriveDashboardActivitySummary,
  type ContentStatistics,
  type DashboardActivitySummary,
  type QueueCountItem,
} from "./services/content-statistics.server";
export {
  loadFlowData,
  type LoadFlowDataParams,
  type LoadFlowDataResult,
  type FlowItemDTO,
} from "./services/flow-loader.server";
export { getRunwayLastScheduledAtUtcMs } from "./runway/index.server";
export {
  getScheduleNext7DaysCounts,
  type ScheduleDayCount,
} from "./services/schedule-next7days.server";
export {
  getTopPublishedPostsByEngagement,
  type TopPostItem,
} from "./services/top-posts.server";

export { handleDashboardAction } from "./services/dashboard-action.server";

// ============================================================================
// Draft Services (from drafts submodule)
// ============================================================================

export {
  loadDraftsData,
  handleDraftsAction,
  loadDraftEditData,
  handleDraftEditAction,
  createShortDraftVersion,
  SHORT_SNAPSHOT_SCHEMA_VERSION,
  createLongformDraftVersion,
  LONGFORM_SNAPSHOT_SCHEMA_VERSION,
  getDraftVersions,
  getDraftVersionById,
  listBulkDraftGroups,
  getOrCreateDraftGroup,
  deleteDraftGroupPosts,
  createDraftGroupVersion,
  getBulkDraftGroupPosts,
  signDraftForScheduling,
  restoreLongformDraftVersion,
} from "./drafts/index.server";
export type { BulkDraftSnapshotRow } from "./drafts/index.server";

// ============================================================================
// Long Form Services (from longform submodule)
// ============================================================================

export {
  loadLongFormEditData,
  handleLongFormEditAction,
  loadNewLongFormData,
  handleNewLongFormAction,
  calculateLongFormStatus,
  LongFormPostStateMachine,
  CreateLongFormPostUseCase,
  ScheduleLongFormPostUseCase,
  CancelScheduleLongFormUseCase,
  MoveScheduledLongFormToDraftUseCase,
  PublishLongFormNowUseCase,
} from "./longform/index.server";
export type {
  LongFormStatus,
  LongFormStatusCalculation,
  LongFormPostState,
  LongFormPostStateTransition,
  LongFormPostStateInconsistency,
  CreateLongFormPostInput,
  CreateLongFormPostResult,
  ScheduleLongFormPostInput,
  PublishLongFormNowInput,
  CancelLongFormPostInput,
  MoveScheduledLongFormToDraftInput,
} from "./longform/index.server";

// ============================================================================
// New Post Services (from composer submodule)
// ============================================================================

export {
  loadNewPostData,
  handleNewPostAction,
  CreatePostUseCase,
} from "./composer/index.server";

// ============================================================================
// Queue Type Resolver
// ============================================================================

export { resolveQueueTypeId } from "./services/queue-type-resolver.server";

// ============================================================================
// Calendar (submodule)
// ============================================================================

export {
  handleCalendarAction,
  loadCalendarData,
  loadCalendarQueueData,
  postsToCalendarPosts,
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
} from "./calendar/index.server";

export { getPostDataForModal } from "./services/post-data-loader.server";

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
