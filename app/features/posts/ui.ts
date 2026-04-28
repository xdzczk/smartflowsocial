/**
 * Posts Feature Client-Side API (shared only)
 *
 * This module exports shared client-only components, hooks, and utilities.
 * For submodule-specific UI, use:
 *   ~/features/posts/calendar
 *   ~/features/posts/composer
 *   ~/features/posts/scheduling
 *   ~/features/posts/publishing
 *   ~/features/posts/longform
 *   ~/features/posts/drafts
 *   ~/features/posts/runway
 *
 * Usage:
 *   import { DashboardIndexPage, useFlowData } from "~/features/posts/ui";
 *   import { ScheduledPostsPage } from "~/features/posts/scheduling";
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
// Dashboard and flow (cross-cutting)
// ============================================================================

export {
  FlowView,
  getGoLiveAt,
  type FlowViewHandle,
} from "./components/FlowView";
export { FlowCard } from "./components/FlowCard";
export { useFlowData, flowKeys } from "./hooks/useFlowQuery";
export type { UseFlowDataResult } from "./hooks/useFlowQuery";
export { useDashboardState } from "./hooks/useDashboardState";
export {
  useDashboardQuery,
  useDashboardData,
  useDashboardInfiniteQuery,
  useDashboardInfiniteData,
  dashboardKeys,
} from "./hooks/useDashboardQuery";
export type { DashboardLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export type { PublishedPostsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export type { ScheduledPostsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export type { DraftsLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export type { CalendarLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export type { CalendarQueueLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export type { RecyclablesLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export { default as DashboardIndexPage } from "./components/DashboardIndexPage";

// ============================================================================
// Shared modals and components (used by more than one submodule or routes)
// ============================================================================

export { EditPostModal } from "./components/EditPostModal";
export { default as PostDetailsModal } from "./components/PostDetailsModal";
export { default as PublishResultModal } from "./components/PublishResultModal";
export { QueuesPanel as Queues } from "./components/QueuesPanel";
export type { QueuesPanelProps as QueuesProps } from "./components/QueuesPanel";
export { default as QueueSelectionTabs } from "./components/QueueSelectionTabs";
export { default as PostTypeTabs } from "./components/PostTypeTabs";
export { ContentListPageHeader } from "./components/ContentListPageHeader";
export {
  AttachmentCountChip,
  buildDashboardContentTypeFilterItems,
  buildLibraryContentTypeFilterItems,
  ContentStatusChip,
  ContentTypeChip,
  FilterDateRangeControls,
  FilterToolbarRow,
  PublishingArchiveModeLinks,
  PublishingBatchSelectionBar,
  PublishingContentTypeFilter,
  PublishingEmptyState,
  PublishingFilterRow,
  PublishingLibraryContentSegments,
  PublishingLibraryShell,
  PublishingPageHeader,
  PublishingQueueFilter,
  PublishingSegmentedControlButtons,
  PublishingSegmentedControlLinks,
  QueueStatusChip,
  TemplateKindChip,
  TextOnlyIndicatorChip,
} from "./components/publishing-suite";
export type {
  PublishingContentTypeFilterItem,
  PublishingSegmentButtonItem,
  PublishingSegmentLinkItem,
} from "./components/publishing-suite";
export {
  PUBLISHING_BATCH_SELECTION_BAR_CLASS,
  PUBLISHING_DATETIME_CELL_CLASS,
  PUBLISHING_FILTER_SELECT_TRIGGER_CLASS,
  PUBLISHING_LIST_SURFACE_CLASS,
  PUBLISHING_METADATA_CHIP_GAP_CLASS,
  PUBLISHING_QUEUE_NEUTRAL_CHIP_CLASS,
  PUBLISHING_TABLE_ROW_CLASS,
  PUBLISHING_TEMPLATE_TYPE_SELECT_TRIGGER_CLASS,
} from "./components/publishing-suite/constants";
export { default as AllContentListing } from "./components/AllContentListing";
export { default as Statistics } from "./components/Statistics";
export { SuccessMessage } from "./components/SuccessMessage";
export { ErrorMessage } from "./components/ErrorMessage";
export { NewPostHeader } from "./components/NewPostHeader";
export type { ComposerStatus } from "./components/NewPostHeader";
export { RelaySelectorModal } from "./components/RelaySelectorModal";
export { PublishingSummaryRail } from "./components/ConfidencePanel";
export { TagsChipRow } from "./components/TagsChipRow";
export { AttachmentsStrip } from "./components/AttachmentsStrip";
export { AlsoScheduleBlock } from "./components/AlsoScheduleBlock";
export { ResumeModal } from "./components/ResumeModal";
export { HashtagPresetsSettings } from "./components/HashtagPresetsSettings";
export { QueueTypesSettings } from "./components/QueueTypesSettings";
export { PostsSearch } from "./components/PostsSearch";
export {
  default as TopPostsList,
  type TopPostItemDTO,
} from "./components/TopPostsList";
export { RunwaySettingsModal } from "./runway";

// ============================================================================
// Bulk page and its direct dependencies (shared: used by bulk route and composer modal)
// ============================================================================

export { default as BulkPostsPage } from "./components/BulkPostsPage";
export { default as BulkPostsActionButtons } from "./components/BulkPostsActionButtons";
export { default as BulkPostsSchedulingPanel } from "./components/BulkPostsSchedulingPanel";
export { default as BulkPostsUploadArea } from "./components/BulkPostsUploadArea";
export { BulkPostsPageSkeleton } from "./components/BulkPostsPageSkeleton";

// ============================================================================
// Shared mutations (used across pages)
// ============================================================================

export {
  useInvalidatePostQueries,
  useDeletePostMutation,
  useBulkDeleteMutation,
  useReschedulePostMutation,
} from "./hooks/usePostMutations";
export { useEditPostMutation } from "./hooks/useEditPostMutation";
