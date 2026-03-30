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
export type { SettingsLoaderData } from "./settings-loader.server";

// ============================================================================
// Settings Actions
// ============================================================================

export { handleSettingsAction } from "./settings-actions.server";

// ============================================================================
// Components (Public API)
// ============================================================================

export { SettingsAwaitError } from "./components/SettingsAwaitError";
export { SettingsPageSkeleton } from "./components/SettingsPageSkeleton";
export { default as SettingsPage } from "./components/SettingsPage";
export { SettingsShell } from "./components/SettingsShell";
export * from "./components/patterns";
export {
  getVisibleSettingsSections,
  getSettingsDefaultTab,
  resolveSettingsTab,
  type SettingsTabId,
  type SettingsSectionDef,
} from "./settings-sections";
export { SettingsResolvedLoaderProvider } from "./context/SettingsResolvedLoaderContext";
