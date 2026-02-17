/**
 * Posts Feature Client-Side API
 *
 * This module exports client-only components, hooks, and utilities.
 * Use this import path for React components and client-side hooks.
 *
 * Usage:
 *   import { AllContentListing, usePublishedPostsQuery } from "~/features/posts/ui";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./components/..."  // ❌ Bad
 *   import { ... } from "./hooks/..."       // ❌ Bad
 */

// ============================================================================
// Types (re-exported for client-side usage)
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
export type { LongFormPost as LongFormPostType } from "@prisma/client";

export { convertJsonValueToScheduleConfig } from "./types";

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

export { getQueueColor, getQueueAccentHex } from "./queue-colors";

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
export { ContentListPageHeader } from "./components/ContentListPageHeader";
export { EditPostModal } from "./components/EditPostModal";
export {
  FlowView,
  getGoLiveAt,
  type FlowViewHandle,
} from "./components/FlowView";
export { FlowCard } from "./components/FlowCard";
export { default as LongFormDetailsModal } from "./components/LongFormDetailsModal";
export { default as LongFormListing } from "./components/LongFormListing";
export { default as PostDetailsModal } from "./components/PostDetailsModal";
export { default as PublishResultModal } from "./components/PublishResultModal";
export { PostsSearch } from "./components/PostsSearch";
export { default as PostTypeTabs } from "./components/PostTypeTabs";
export { default as QueueHealth } from "./components/QueueHealth";
export { default as QueueSelectionTabs } from "./components/QueueSelectionTabs";
export { RunwaySettingsModal } from "./components/RunwaySettingsModal";
export { ScheduleNext7DaysCard } from "./components/ScheduleNext7DaysCard";
export { ScheduleOverviewTargetModal } from "./components/ScheduleOverviewTargetModal";
export { ScheduledPostsTable } from "./components/ScheduledPostsTable";
export { SimpleRescheduleModal } from "./components/SimpleRescheduleModal";
export { default as Statistics } from "./components/Statistics";
export { SuccessMessage } from "./components/SuccessMessage";
export {
  default as TopPostsList,
  type TopPostItemDTO,
} from "./components/TopPostsList";
export { default as DraftBulkResume } from "./components/DraftBulkResume";
export { DraftsBulkActions } from "./components/DraftsBulkActions";
export { ErrorMessage } from "./components/ErrorMessage";
export { LongFormEditHeader } from "./components/LongFormEditHeader";
export { default as LongFormPost } from "./components/LongFormPost";
export { default as LongFormPreviewModal } from "./components/LongFormPreviewModal";
export { default as MediaPost } from "./components/MediaPost";
export { NewPostHeader } from "./components/NewPostHeader";
export { default as NewPostImagesConfirmation } from "./components/NewPostImagesConfirmation";
export type { ComposerStatus } from "./components/NewPostHeader";
export { RelaySelectorModal } from "./components/RelaySelectorModal";
export { default as TextPost } from "./components/TextPost";
export { AlsoScheduleBlock } from "./components/AlsoScheduleBlock";
export { AttachmentsStrip } from "./components/AttachmentsStrip";
export { ConfidencePanel } from "./components/ConfidencePanel";
export { TagsChipRow } from "./components/TagsChipRow";
export { UnifiedComposer } from "./components/UnifiedComposer";
export type { UnifiedComposerProps } from "./components/UnifiedComposer";
export { default as NewPostPage } from "./components/NewPostPage";
export { RecyclablesBulkActions } from "./components/RecyclablesBulkActions";
export { RecyclablesPagination } from "./components/RecyclablesPagination";
export {
  DraftPickerModal,
  type DraftPickerType,
} from "./components/DraftPickerModal";
export { DraftEditForm } from "./components/DraftEditForm";
export {
  DraftVersionHistory,
  type DraftVersionItem,
} from "./components/DraftVersionHistory";
export { DraftPreview } from "./components/DraftPreview";
export { ResumeModal } from "./components/ResumeModal";
export { default as DraftEditPage } from "./components/DraftEditPage";
export { default as PublishedPostsPage } from "./components/PublishedPostsPage";
export { default as ScheduledPostsPage } from "./components/ScheduledPostsPage";
export { default as DashboardIndexPage } from "./components/DashboardIndexPage";
export { default as DraftsPage } from "./components/DraftsPage";
export { default as CalendarPage } from "./components/CalendarPage";
export { default as RecyclablesPage } from "./components/RecyclablesPage";
export { default as BulkPostsPage } from "./components/BulkPostsPage";
export { default as CalendarQueuePage } from "./components/CalendarQueuePage";
export { default as LongFormDraftEditPage } from "./components/LongFormDraftEditPage";
export { BulkDraftsListing } from "./components/BulkDraftsListing";
export { DraftsTable } from "./components/DraftsTable";
export { default as PublishedPostsTable } from "./components/PublishedPostsTable";
export { RecyclablesQueueTabs } from "./components/RecyclablesQueueTabs";
export { RecyclablesSearch } from "./components/RecyclablesSearch";
export { RecyclablesTable } from "./components/RecyclablesTable";
export { RecyclablesToast } from "./components/RecyclablesToast";
export { NewLongFormHeader } from "./components/NewLongFormHeader";
export { default as NewLongFormPostPage } from "./components/NewLongFormPostPage";
export { HashtagPresetsSettings } from "./components/HashtagPresetsSettings";
export { QueueTypesSettings } from "./components/QueueTypesSettings";
export { ScheduleIntervalsSettings } from "./components/ScheduleIntervalsSettings";
export { default as BulkPostsActionButtons } from "./components/BulkPostsActionButtons";
export { default as BulkPostsSchedulingPanel } from "./components/BulkPostsSchedulingPanel";
export { default as BulkPostsTable } from "./components/BulkPostsTable";
export { default as BulkPostsUploadArea } from "./components/BulkPostsUploadArea";
export { default as PostConfirmation } from "./components/PostConfirmation";
export {
  BulkComposerModal,
  type BulkComposerMode,
  type BulkComposerModalProps,
} from "./components/BulkComposerModal";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { useDashboardState } from "./hooks/useDashboardState";
export { useScheduledState } from "./hooks/useScheduledState";
export { useDraftsState } from "./hooks/useDraftsState";
export {
  usePublishedPosts,
  type BulkComposerPayload,
} from "./usePublishedPosts";
export {
  usePublishedPostsQuery,
  usePublishedPostsData,
  usePublishedPostsInfiniteQuery,
  usePublishedPostsInfiniteData,
  useBulkDeletePostsMutation,
  publishedPostsKeys,
} from "./hooks/usePublishedPostsQuery";
export type { PublishedPostsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export {
  useDashboardQuery,
  useDashboardData,
  useDashboardInfiniteQuery,
  useDashboardInfiniteData,
  dashboardKeys,
} from "./hooks/useDashboardQuery";
export type { DashboardLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export {
  useScheduledPostsQuery,
  useScheduledPostsData,
  useScheduledPostsInfiniteQuery,
  useScheduledPostsInfiniteData,
  scheduledPostsKeys,
} from "./hooks/useScheduledPostsQuery";
export type { ScheduledPostsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export {
  useDraftsQuery,
  useDraftsData,
  useDraftsInfiniteQuery,
  useDraftsInfiniteData,
  draftsKeys,
} from "./hooks/useDraftsQuery";
export type { DraftsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export {
  useCalendarQuery,
  useCalendarData,
  calendarKeys,
} from "./hooks/useCalendarQuery";
export type { CalendarLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export {
  useCalendarQueueQuery,
  useCalendarQueueData,
  calendarQueueKeys,
} from "./hooks/useCalendarQueueQuery";
export type { CalendarQueueLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export { useFlowData, flowKeys } from "./hooks/useFlowQuery";
export type { UseFlowDataResult } from "./hooks/useFlowQuery";
export {
  useInvalidatePostQueries,
  useDeletePostMutation,
  useBulkDeleteMutation,
  useReschedulePostMutation,
} from "./hooks/usePostMutations";
export { useEditPostMutation } from "./hooks/useEditPostMutation";
export { useRecyclablesState } from "./hooks/useRecyclablesState";
export type { IndividualRepostFetcherData } from "./hooks/useRecyclablesState";
export {
  useRecyclablesQuery,
  useRecyclablesData,
  useRecyclablesInfiniteQuery,
  useRecyclablesInfiniteData,
  recyclablesKeys,
} from "./hooks/useRecyclablesQuery";
export type { RecyclablesLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export { useDraftEditState } from "./hooks/useDraftEditState";
export { useLongFormEditState } from "./hooks/useLongFormEditState";
export { useNewLongFormState } from "./hooks/useNewLongFormState";
export { useNewPostState } from "./hooks/useNewPostState";
