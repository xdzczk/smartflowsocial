/**
 * Settings area navigation — single source of truth for shell nav, URL ?tab=, and visibility rules.
 */

export type SettingsTabId =
  | "general"
  | "content"
  | "accounts"
  | "network"
  | "storage"
  | "subscription"
  | "referral";

export interface SettingsSectionDef {
  id: SettingsTabId;
  label: string;
  /** Optional muted line under label (desktop nav only when needed) */
  description?: string;
}

const SECTIONS_ORDERED: readonly SettingsSectionDef[] = [
  { id: "general", label: "General" },
  { id: "content", label: "Content" },
  { id: "accounts", label: "Accounts" },
  { id: "network", label: "Network" },
  { id: "storage", label: "Storage" },
  { id: "subscription", label: "Subscription" },
  { id: "referral", label: "Referral" },
] as const;

export function getVisibleSettingsSections(input: {
  isChild: boolean;
  hasAccountsAccess: boolean;
}): SettingsSectionDef[] {
  return SECTIONS_ORDERED.filter((s) => {
    if (s.id === "accounts" && !input.hasAccountsAccess) return false;
    if ((s.id === "subscription" || s.id === "referral") && input.isChild) {
      return false;
    }
    return true;
  });
}

/**
 * Legacy rules: child users cannot open subscription/referral; accounts tab requires access.
 */
export function getSettingsDefaultTab(input: {
  tabParam: string | null;
  isChild: boolean;
  hasAccountsAccess: boolean;
}): SettingsTabId {
  const requested = (input.tabParam ?? "general") as SettingsTabId;
  if (
    input.isChild &&
    (requested === "subscription" || requested === "referral")
  ) {
    return "general";
  }
  if (!input.hasAccountsAccess && requested === "accounts") {
    return "general";
  }
  return requested;
}

export function resolveSettingsTab(input: {
  tabParam: string | null;
  isChild: boolean;
  hasAccountsAccess: boolean;
}): SettingsTabId {
  const visible = new Set(getVisibleSettingsSections(input).map((s) => s.id));
  const candidate = getSettingsDefaultTab(input);
  if (visible.has(candidate)) return candidate;
  return "general";
}
