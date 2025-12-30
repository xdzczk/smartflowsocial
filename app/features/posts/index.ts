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
  QueueType,
  UserData,
  HashTagPreset,
  PostFetcher,
} from "./types";

// Re-export Prisma types for convenience (when needed for type annotations)
export type { LongFormPost as LongFormPostType } from "@prisma/client";

export {
  convertJsonValueToScheduleConfig,
} from "./types";

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

// Note: getLongFormDashboardData is not exported from longform.server
// export {
//   getLongFormDashboardData,
// } from "./longform.server";

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
  filterPostsArraysByQueueType,
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
  getQueueColor,
} from "./queueColors";

// Note: QueueTypeOption is not exported from queueTypes.client
// export type {
//   QueueTypeOption,
// } from "./queueTypes.client";

// ============================================================================
// Dashboard Services (Loaders)
// ============================================================================

export {
  loadDashboardData,
} from "./services/dashboard-loader.server";

export {
  handleDashboardAction,
} from "./services/dashboard-action.server";

export {
  loadDraftsData,
} from "./services/drafts-loader.server";
export { handleDraftsAction } from "./services/drafts-action.server";

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

// Note: handleDraftSignAction is not exported from draft-sign.server
// export {
//   handleDraftSignAction,
// } from "./services/draft-sign.server";

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
  resolveQueueTypeId,
} from "./services/queue-type-resolver.server";

// ============================================================================
// Long Form Status Calculator
// ============================================================================

export {
  calculateLongFormStatus,
} from "./services/longform-status-calculator.server";

// ============================================================================
// Calendar Services
// ============================================================================

export { handleCalendarAction } from "./services/calendar-action.server";
export { loadCalendarData, loadCalendarQueueData } from "./services/calendar-loader.server";

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
// Calendar Components
// ============================================================================

export { Calendar } from "./components/Calendar/Calendar";

// ============================================================================
// Calendar Utilities
// ============================================================================

export {
  postsToCalendarPosts,
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
} from "./utils/calendar-post-converter";

// ============================================================================
// Components (Public API)
// ============================================================================

export { default as AllContentListing } from "./components/AllContentListing";
export { BulkDeleteBar } from "./components/BulkDeleteBar";
export { DashboardHeader } from "./components/DashboardHeader";
export { EditPostModal } from "./components/EditPostModal";
export { default as LongFormDetailsModal } from "./components/LongFormDetailsModal";
export { default as LongFormListing } from "./components/LongFormListing";
export { default as PostDetailsModal } from "./components/PostDetailsModal";
export { PostsSearch } from "./components/PostsSearch";
export { default as PostTypeTabs } from "./components/PostTypeTabs";
export { default as QueueSelectionTabs } from "./components/QueueSelectionTabs";
export { ScheduledPostsTable } from "./components/ScheduledPostsTable";
export { SimpleRescheduleModal } from "./components/SimpleRescheduleModal";
export { default as Statistics } from "./components/Statistics";
export { SuccessMessage } from "./components/SuccessMessage";
export { default as DraftBulkResume } from "./components/DraftBulkResume";
export { DraftsBulkActions } from "./components/DraftsBulkActions";
export { ErrorMessage } from "./components/ErrorMessage";
export { LongFormEditHeader } from "./components/LongFormEditHeader";
export { default as LongFormPost } from "./components/LongFormPost";
export { default as LongFormPreviewModal } from "./components/LongFormPreviewModal";
export { default as MediaPost } from "./components/MediaPost";
export { NewPostHeader } from "./components/NewPostHeader";
export { default as NewPostImagesConfirmation } from "./components/NewPostImagesConfirmation";
export { default as TextPost } from "./components/TextPost";
export { RecyclablesBulkActions } from "./components/RecyclablesBulkActions";
export { RecyclablesPagination } from "./components/RecyclablesPagination";
export { DraftEditForm } from "./components/DraftEditForm";
export { DraftPreview } from "./components/DraftPreview";
export { ResumeModal } from "./components/ResumeModal";
export { DraftsHeader } from "./components/DraftsHeader";
export { DraftsPostTypeTabs } from "./components/DraftsPostTypeTabs";
export { DraftsTable } from "./components/DraftsTable";
export { default as PostedPostsTable } from "./components/PostedPostsTable";
export { default as PostedPostsTabs } from "./components/PostedPostsTabs";
export { RecyclablesQueueTabs } from "./components/RecyclablesQueueTabs";
export { RecyclablesSearch } from "./components/RecyclablesSearch";
export { RecyclablesTable } from "./components/RecyclablesTable";
export { RecyclablesToast } from "./components/RecyclablesToast";
export { NewLongFormHeader } from "./components/NewLongFormHeader";
export { HashtagPresetsSettings } from "./components/HashtagPresetsSettings";
export { QueueTypesSettings } from "./components/QueueTypesSettings";
export { ScheduleIntervalsSettings } from "./components/ScheduleIntervalsSettings";
export { default as BulkPostsActionButtons } from "./components/BulkPostsActionButtons";
export { default as BulkPostsTable } from "./components/BulkPostsTable";
export { default as BulkPostsUploadArea } from "./components/BulkPostsUploadArea";
export { default as PostConfirmation } from "./components/PostConfirmation";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { useDashboardState } from "./hooks/useDashboardState";
export { useScheduledState } from "./hooks/useScheduledState";
export { useDraftsState } from "./hooks/useDraftsState";
export { usePostedPosts } from "./usePostedPosts";
export { useRecyclablesState } from "./hooks/useRecyclablesState";
export type { IndividualRepostFetcherData } from "./hooks/useRecyclablesState";
export { useDraftEditState } from "./hooks/useDraftEditState";
export { useLongFormEditState } from "./hooks/useLongFormEditState";
export { useNewLongFormState } from "./hooks/useNewLongFormState";
export { useNewPostState } from "./hooks/useNewPostState";

