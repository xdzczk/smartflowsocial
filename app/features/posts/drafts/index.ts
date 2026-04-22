/**
 * Drafts submodule: client UI and hooks.
 * Exports from local components and re-exports hooks from parent.
 */
export { default as DraftsPage } from "./components/DraftsPage";
export { default as DraftEditPage } from "./components/DraftEditPage";
export { default as DraftBulkResume } from "./components/DraftBulkResume";
export { DraftsBulkActions } from "./components/DraftsBulkActions";
export { DraftsToolbar } from "./components/DraftsToolbar";
export { DraftsTable } from "./components/DraftsTable";
export { BulkDraftsListing } from "../components/BulkDraftsListing";
export { DraftEditForm } from "./components/DraftEditForm";
export { DraftPreview } from "./components/DraftPreview";
export {
  DraftVersionHistory,
  type DraftVersionItem,
} from "./components/DraftVersionHistory";
export {
  DraftPickerModal,
  type DraftPickerType,
  type DraftsAndTemplatesPickerOptions,
  type ShortDraftFilter,
} from "./components/DraftPickerModal";
export {
  isPollDraftPost,
  isThreadDraftPost,
  isShortPostDraftForPostsTab,
  isRepostDraftPost,
} from "./utils/draft-post-classification";
export {
  getShortDraftComposeType,
  getShortDraftComposeUrl,
  getShortDraftEditRedirectPath,
  getLongFormDraftEditUrl,
  getBulkGroupUrl,
} from "./utils/draft-editor-navigation";
export {
  buildDraftRowPreview,
  draftTypeLabel,
  type DraftRowPreview,
} from "./utils/draft-row-preview";

// Re-export hooks from parent so consumers can use ~/features/posts/drafts or ~/features/posts/ui
export {
  useDraftsQuery,
  useDraftsData,
  useDraftsInfiniteQuery,
  useDraftsInfiniteData,
  draftsKeys,
} from "../hooks/useDraftsQuery";
export { useDraftsState } from "../hooks/useDraftsState";

// signDraftForScheduling is used by useDraftEditState (client hook) for signing.
// Lives in `draft-sign.client.ts` because signing requires the user's NIP-07 /
// NIP-46 signer, which is only available in the browser.
export { signDraftForScheduling } from "./services/draft-sign.client";
