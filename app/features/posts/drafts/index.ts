/**
 * Drafts submodule: client UI and hooks.
 * Exports from local components and re-exports hooks from parent.
 */
export { default as DraftsPage } from "./components/DraftsPage";
export { default as DraftEditPage } from "./components/DraftEditPage";
export { default as DraftBulkResume } from "./components/DraftBulkResume";
export { DraftsBulkActions } from "./components/DraftsBulkActions";
export { DraftsTable } from "./components/DraftsTable";
export { DraftEditForm } from "./components/DraftEditForm";
export { DraftPreview } from "./components/DraftPreview";
export {
  DraftVersionHistory,
  type DraftVersionItem,
} from "./components/DraftVersionHistory";
export {
  DraftPickerModal,
  type DraftPickerType,
} from "./components/DraftPickerModal";

// Re-export hooks from parent so consumers can use ~/features/posts/drafts or ~/features/posts/ui
export {
  useDraftsQuery,
  useDraftsData,
  useDraftsInfiniteQuery,
  useDraftsInfiniteData,
  draftsKeys,
} from "../hooks/useDraftsQuery";

// signDraftForScheduling is used by useDraftEditState (client hook) for signing
export { signDraftForScheduling } from "./services/draft-sign.server";
