/**
 * Templates Feature Public API
 *
 * This module exports the public API for template-related operations.
 * Internal implementation details are kept in services/, hooks/, and components/ directories.
 *
 * Usage:
 *   import { loadTemplatesData, handleTemplateAction } from "~/features/templates";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./services/..."  // ❌ Bad
 *   import { ... } from "./hooks/..."    // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type { Template } from "./types";

// ============================================================================
// Template Services
// ============================================================================

export { loadTemplatesData } from "./services/templates-loader.server";

export { handleTemplatesAction } from "./services/templates-action.server";

export {
  loadTemplateEditData,
  handleTemplateEditAction,
} from "./services/template-edit.server";

export {
  handleCreateTemplateFromScratchPost,
  handleCreateTemplateFromScratchLongform,
} from "./services/templates-create-from-scratch.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { TemplateDetailsModal } from "./components/TemplateDetailsModal";
export { TemplatesHeader } from "./components/TemplatesHeader";
export { TemplatesTabs } from "./components/TemplatesTabs";
export { ToastNotification } from "./components/ToastNotification";
export { default as TemplatesPage } from "./components/TemplatesPage";
export { default as TemplateEditPage } from "./components/TemplateEditPage";

// ============================================================================
// Hooks (Public API)
// ============================================================================

export { useTemplatesState } from "./hooks/useTemplatesState";
export {
  useTemplatesQuery,
  useTemplatesData,
  useTemplatesInfiniteQuery,
  useTemplatesInfiniteData,
  templatesKeys,
} from "./hooks/useTemplatesQuery";
export type { TemplatesLoaderData } from "~/lib/validation/schemas/loader-responses.schemas";
export { TemplatesPageSkeleton } from "./components/TemplatesPageSkeleton";
