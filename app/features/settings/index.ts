/**
 * Settings Feature Public API
 *
 * This module exports the public API for user settings operations.
 * Internal implementation details are kept in actions/ directory.
 *
 * Usage:
 *   import { loadSettingsData, handleSettingsAction } from "~/features/settings";
 *
 * Do NOT import from internal paths like:
 *   import { ... } from "./actions/..."  // ❌ Bad
 */

// ============================================================================
// Settings Loader
// ============================================================================

export { loadSettingsData } from "./settings-loader.server";

// ============================================================================
// Settings Actions
// ============================================================================

export { handleSettingsAction } from "./settings-actions.server";


