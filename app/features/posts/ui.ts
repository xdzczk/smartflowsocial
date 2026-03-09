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
export type { LongFormPost as LongFormPostType } from "./data/posts-prisma-types.server";

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
// Calendar (submodule)
// ============================================================================

export {
  Calendar,
  CalendarPage,
  CalendarQueuePage,
  useCalendarQuery,
  useCalendarData,
  calendarKeys,
  useCalendarQueueQuery,
  useCalendarQueueData,
  calendarQueueKeys,
  postsToCalendarPosts,
  longFormPostsToCalendarPosts,
  mixedPostsToCalendarPosts,
} from "./calendar";

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
export { LongFormDetailsModal, LongFormListing } from "./longform";
export { default as PostDetailsModal } from "./components/PostDetailsModal";
export { default as PublishResultModal } from "./components/PublishResultModal";
export { PostsSearch } from "./components/PostsSearch";
export { default as PostTypeTabs } from "./components/PostTypeTabs";
export { default as QueueHealth } from "./components/QueueHealth";
export { default as QueueSelectionTabs } from "./components/QueueSelectionTabs";
export { RunwaySettingsModal } from "./runway";
export {
  ScheduleNext7DaysCard,
  ScheduleOverviewTargetModal,
  ScheduledPostsTable,
  SimpleRescheduleModal,
  ScheduleRepostQuoteModal,
} from "./scheduling";
export { default as Statistics } from "./components/Statistics";
export { SuccessMessage } from "./components/SuccessMessage";
export {
  default as TopPostsList,
  type TopPostItemDTO,
} from "./components/TopPostsList";
export { DraftBulkResume, DraftsBulkActions } from "./drafts";
export { ErrorMessage } from "./components/ErrorMessage";
export {
  LongFormEditHeader,
  LongFormPost,
  LongFormPreviewModal,
} from "./longform";
export { NewPostHeader } from "./components/NewPostHeader";
export { default as NewPostImagesConfirmation } from "./components/NewPostImagesConfirmation";
export type { ComposerStatus } from "./components/NewPostHeader";
export { RelaySelectorModal } from "./components/RelaySelectorModal";
export { AlsoScheduleBlock } from "./components/AlsoScheduleBlock";
export { AttachmentsStrip } from "./components/AttachmentsStrip";
export { ConfidencePanel } from "./components/ConfidencePanel";
export { TagsChipRow } from "./components/TagsChipRow";
export { UnifiedComposer, type UnifiedComposerProps } from "./composer";
export { NewPostPage } from "./composer";
export { RecyclablesBulkActions, RecyclablesPagination } from "./publishing";
export { DraftPickerModal, type DraftPickerType } from "./drafts";
export { DraftEditForm } from "./drafts";
export { DraftVersionHistory, type DraftVersionItem } from "./drafts";
export { DraftPreview } from "./drafts";
export { ResumeModal } from "./components/ResumeModal";
export { DraftEditPage } from "./drafts";
export { PublishedPostsPage, RecyclablesPage } from "./publishing";
export { default as ScheduledPostsPage } from "./scheduling";
export { default as DashboardIndexPage } from "./components/DashboardIndexPage";
export { DraftsPage } from "./drafts";
export { default as BulkPostsPage } from "./components/BulkPostsPage";
export { LongFormDraftEditPage } from "./longform";
export { BulkDraftsListing } from "./components/BulkDraftsListing";
export { DraftsTable } from "./drafts";
export {
  PublishedPostsTable,
  RecyclablesQueueFilter,
  RecyclablesQueueTabs,
  RecyclablesSearch,
  RecyclablesTable,
  RecyclablesToast,
} from "./publishing";
export { NewLongFormHeader, NewLongFormPostPage } from "./longform";
export { HashtagPresetsSettings } from "./components/HashtagPresetsSettings";
export { QueueTypesSettings } from "./components/QueueTypesSettings";
export { ScheduleIntervalsSettings } from "./scheduling";
export { default as BulkPostsActionButtons } from "./components/BulkPostsActionButtons";
export { default as BulkPostsSchedulingPanel } from "./components/BulkPostsSchedulingPanel";
export { default as BulkPostsTable } from "./components/BulkPostsTable";
export { default as BulkPostsUploadArea } from "./components/BulkPostsUploadArea";
export { default as PostConfirmation } from "./components/PostConfirmation";
export {
  BulkComposerModal,
  type BulkComposerMode,
  type BulkComposerModalProps,
  type BulkComposerUser,
} from "./composer";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { useDashboardState } from "./hooks/useDashboardState";
export { useScheduledState, usePostScheduling } from "./scheduling";
export { useDraftsState } from "./hooks/useDraftsState";
export {
  usePublishedPosts,
  type BulkComposerPayload,
  usePublishedPostsQuery,
  usePublishedPostsData,
  usePublishedPostsInfiniteQuery,
  usePublishedPostsInfiniteData,
  useBulkDeletePostsMutation,
  publishedPostsKeys,
} from "./publishing";
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
} from "./scheduling";
export type { ScheduledPostsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export {
  useDraftsQuery,
  useDraftsData,
  useDraftsInfiniteQuery,
  useDraftsInfiniteData,
  draftsKeys,
} from "./hooks/useDraftsQuery";
export type { DraftsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export type { CalendarLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
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
export {
  useRecyclablesState,
  type IndividualRepostFetcherData,
  useRecyclablesQuery,
  useRecyclablesData,
  useRecyclablesInfiniteQuery,
  useRecyclablesInfiniteData,
  recyclablesKeys,
} from "./publishing";
export type { RecyclablesLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export { useDraftEditState } from "./hooks/useDraftEditState";
export { useLongFormEditState } from "./hooks/useLongFormEditState";
export { useNewLongFormState } from "./hooks/useNewLongFormState";
export { useNewPostState, useLocalDraft } from "./composer";
