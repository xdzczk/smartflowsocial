/**
 * Settings V2 section patterns — use consistently across tabs.
 *
 * Action scale:
 * - Primary: high-stakes commits (billing, provider change, payout).
 * - Secondary/outline: add, manage, edit lists.
 * - Ghost/link: light actions.
 * - Destructive: only inside DestructiveSection or equivalent isolation.
 */
export { SettingsSectionHeader } from "./SettingsSectionHeader";
export type { SettingsSectionHeaderProps } from "./SettingsSectionHeader";
export { PreferenceSection } from "./PreferenceSection";
export type { PreferenceSectionProps } from "./PreferenceSection";
export { ManagementListSection } from "./ManagementListSection";
export type { ManagementListSectionProps } from "./ManagementListSection";
export { ProviderSelectionSection } from "./ProviderSelectionSection";
export type { ProviderSelectionSectionProps } from "./ProviderSelectionSection";
export { AccountSummarySection } from "./AccountSummarySection";
export type { AccountSummarySectionProps } from "./AccountSummarySection";
export { DestructiveSection } from "./DestructiveSection";
export type { DestructiveSectionProps } from "./DestructiveSection";
