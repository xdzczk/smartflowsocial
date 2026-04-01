/**
 * Settings section patterns (V4) — align with app settings primitives:
 * - PreferenceSection — small defaults (timezone, formats, zap default).
 * - ToggleRowSection — label + description + right-aligned switch.
 * - ManagementListSection — queues, presets, relays, templates, lists.
 * - ProviderSelectionSection — option-card style infra pickers.
 * - AccountSummarySection — billing/plan summaries.
 * - DestructiveSection — cancel, delete, risky resets.
 */
export { SettingsSectionHeader } from "./SettingsSectionHeader";
export type { SettingsSectionHeaderProps } from "./SettingsSectionHeader";
export { PreferenceSection } from "./PreferenceSection";
export type { PreferenceSectionProps } from "./PreferenceSection";
export { ToggleRowSection } from "./ToggleRowSection";
export type { ToggleRowSectionProps } from "./ToggleRowSection";
export { ManagementListSection } from "./ManagementListSection";
export type { ManagementListSectionProps } from "./ManagementListSection";
export { ProviderSelectionSection } from "./ProviderSelectionSection";
export type { ProviderSelectionSectionProps } from "./ProviderSelectionSection";
export { AccountSummarySection } from "./AccountSummarySection";
export type { AccountSummarySectionProps } from "./AccountSummarySection";
export { DestructiveSection } from "./DestructiveSection";
export type { DestructiveSectionProps } from "./DestructiveSection";
