/**
 * Composer submodule: client UI.
 */
export { UnifiedComposer } from "./components/UnifiedComposer";
export type {
  ContestEmbedPublishPayload,
  UnifiedComposerProps,
} from "./components/UnifiedComposer";
export { default as NewPostPage } from "./components/NewPostPage";
export {
  BulkComposerModal,
  type BulkComposerMode,
  type BulkComposerModalProps,
  type BulkComposerUser,
} from "./components/BulkComposerModal";
export { useComposerSubmit } from "./hooks/useComposerSubmit";
export type {
  TextPostFormData,
  ThreadSegment,
  UseComposerSubmitOptions,
} from "./hooks/useComposerSubmit";
export { useComposerState } from "./hooks/useComposerState";
export type { ComposerStateInput } from "./hooks/useComposerState";
export { useComposerAutosave } from "./hooks/useComposerAutosave";
export {
  useComposerLocalDraft,
  useLocalDraft,
} from "./hooks/useComposerLocalDraft";
export type { ComposerLocalSnapshot } from "./hooks/useComposerLocalDraft";
export { useNewPostState } from "./hooks/useNewPostState";
