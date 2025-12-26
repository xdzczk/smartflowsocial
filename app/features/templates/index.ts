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
 *   import { ... } from "~/features/templates/services/..."  // ❌ Bad
 *   import { ... } from "~/features/templates/hooks/..."    // ❌ Bad
 */

// ============================================================================
// Types
// ============================================================================

export type {
  Template,
} from "./types";

// ============================================================================
// Template Services
// ============================================================================

export {
  loadTemplatesData,
} from "./services/templates-loader.server";

export {
  handleTemplateAction,
} from "./services/templates-action.server";

