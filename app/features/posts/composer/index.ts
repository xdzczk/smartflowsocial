/**
 * Composer submodule: client UI.
 */
export { UnifiedComposer } from "./components/UnifiedComposer";
export type {
  ContestEmbedPublishPayload,
  UnifiedComposerProps,
} from "./components/UnifiedComposer";
export { default as NewPostPage } from "./components/NewPostPage";
export { CreateComposerShell } from "./components/CreateComposerShell";
export {
  ComposerEditingModeCallout,
  type ComposerEditingMeta,
} from "./components/ComposerEditingModeCallout";
export { parseComposerContextFromLoader } from "./parse-composer-context-loader";
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
export {
  buildComposeEditUrl,
  buildComposeCreateUrl,
  getComposeMode,
  parseComposerContext,
  normalizeComposeType,
  shouldDispatchToLongform,
} from "./services/compose-route-contract";
export type {
  ComposeContentType,
  ComposerContext,
  ComposerMode,
} from "./services/compose-route-contract";
