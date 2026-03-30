/**
 * Posts Feature Server-Side API (shared only)
 *
 * This module exports shared server-only functions and types.
 * For submodule-specific logic, use:
 *   ~/features/posts/server/scheduling
 *   ~/features/posts/server/publishing
 *   ~/features/posts/server/drafts
 *   ~/features/posts/server/longform
 *   ~/features/posts/server/composer
 *   ~/features/posts/server/calendar
 *   ~/features/posts/server/runway
 *
 * Usage:
 *   import { loadDashboardData, getPostDataForModal } from "~/features/posts/server";
 *   import { loadScheduledData } from "~/features/posts/server/scheduling";
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
} from "../types";

export type { PostDTO, LongFormPostDTO } from "../dtos";
export {
  toPostDTO,
  toPostDTOArray,
  fromPostDTO,
  fromPostDTOArray,
  toLongFormPostDTO,
  toLongFormPostDTOArray,
  fromLongFormPostDTO,
  fromLongFormPostDTOArray,
} from "../dtos";

export type { LongFormPost as LongFormPostType } from "../data/posts-prisma-types.server";
export { convertJsonValueToScheduleConfig } from "../types";

// ============================================================================
// Post and longform data layer (commands, queries, types)
// ============================================================================

export * from "../data/index.server";

// ============================================================================
// Dashboard and flow loaders
// ============================================================================

export { loadDashboardData } from "../services/dashboard-loader.server";
export { handleDashboardAction } from "../services/dashboard-action.server";
export {
  getContentStatistics,
  getQueueCountsForDashboard,
  type ContentStatistics,
  type QueueCountItem,
} from "../services/content-statistics.server";
export {
  loadFlowData,
  type LoadFlowDataParams,
  type LoadFlowDataResult,
  type FlowItemDTO,
} from "../services/flow-loader.server";
export {
  getScheduleNext7DaysCounts,
  type ScheduleDayCount,
} from "../services/schedule-next7days.server";
export {
  getTopPublishedPostsByEngagement,
  type TopPostItem,
} from "../services/top-posts.server";
export { getRunwayLastScheduledAtUtcMs } from "../runway/index.server";
export { getPostDataForModal } from "../services/post-data-loader.server";
export { getThreadGroupSegmentsForUser } from "../data/thread-group.server";

// ============================================================================
// Content and bulk
// ============================================================================

export { combineContent, postToCombinedContent } from "../combined.server";
export { getBulkPostsDashboardData } from "../services/bulk-posts.server";
export {
  filterPostsByQueueType,
  filterPostsArraysByQueueType,
} from "../services/post-filtering.server";

// ============================================================================
// Cross-cutting actions and utilities
// ============================================================================

export { publishedPostsAction } from "../published.action.server";
export {
  recordReplyPost,
  type RecordReplyPostParams,
} from "../services/record-reply-post.server";
export { getPostStats } from "../stats.server";
export { resolveQueueTypeId } from "../services/queue-type-resolver.server";
export {
  getEffectiveHashtags,
  parseEffectiveHashtagsRequest,
} from "../services/effective-hashtags.server";
export {
  getBatchPosts,
  parseBatchPostsRequest,
} from "../services/batch-posts.server";

// ============================================================================
// Bulk post handlers (shared: used by bulk flow and composer)
// ============================================================================

export {
  handleFileChange,
  processBulkSelectedFiles,
} from "../handlers/file-upload.handler";
export {
  handleCaptionChange,
  handleDateChange,
  handleRemovePost,
} from "../handlers/post-state.handler";
export {
  handleIsRecyclableChange,
  handleBulkRecyclableToggle,
} from "../handlers/recyclable.handler";
export { handleScheduleIntervalClick } from "../handlers/schedule-interval.handler";
export { updateDisplayedHashtags } from "../handlers/hashtag.handler";
export {
  handleQueueTypeChange,
  handleBulkQueueUpdate,
} from "../handlers/queue-type.handler";
