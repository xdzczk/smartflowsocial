/**
 * Settings section patterns (V3 shell) — use consistently across tabs.
 *
 * Spec mapping:
 * - Pattern A — PreferenceSection: timezone, formats, toggles, light defaults.
 * - Pattern B — ManagementListSection: queues, presets, relays, blocklists, mirrors.
 * - Pattern C — ProviderSelectionSection: Blossom, relay source, mutually exclusive infra.
 * - Pattern D — AccountSummarySection: subscription/referral overview, plan state.
 * - Pattern E — DestructiveSection: cancel, delete, risky resets (isolated).
 *
 * Surface hierarchy: prefer muted bordered sections + dividers; reserve heavy cards
 * for dense or dangerous surfaces only.
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
