/**
 * Settings area navigation  -  single source of truth for shell nav, URL ?tab=, and visibility rules.
 */

export type SettingsTabId =
  | "general"
  | "publishing"
  | "engagement"
  | "relays"
  | "media"
  | "signers"
  | "billing"
  | "accounts";

export type SettingsSectionGroupId = "workspace" | "infrastructure" | "billing";

export interface SettingsSectionDef {
  id: SettingsTabId;
  label: string;
  groupId: SettingsSectionGroupId;
  /** Shown above items in this group (desktop rail + mobile grouping). */
  groupLabel: string;
  /** Optional muted line under label (desktop nav only when needed) */
  description?: string;
}

/** Inner billing nav (?billing=) when tab=billing */
export type BillingSegmentId = "overview" | "payments" | "referral";

const GROUP_LABELS: Record<SettingsSectionGroupId, string> = {
  workspace: "Workspace",
  infrastructure: "Infrastructure",
  billing: "Billing",
};

const SECTIONS_ORDERED: readonly SettingsSectionDef[] = [
  {
    id: "general",
    label: "General",
    groupId: "workspace",
    groupLabel: GROUP_LABELS.workspace,
  },
  {
    id: "publishing",
    label: "Publishing",
    groupId: "workspace",
    groupLabel: GROUP_LABELS.workspace,
  },
  {
    id: "engagement",
    label: "Engagement",
    groupId: "workspace",
    groupLabel: GROUP_LABELS.workspace,
  },
  {
    id: "accounts",
    label: "Accounts",
    groupId: "workspace",
    groupLabel: GROUP_LABELS.workspace,
  },
  {
    id: "relays",
    label: "Relays",
    groupId: "infrastructure",
    groupLabel: GROUP_LABELS.infrastructure,
  },
  {
    id: "media",
    label: "Media & storage",
    groupId: "infrastructure",
    groupLabel: GROUP_LABELS.infrastructure,
  },
  {
    id: "signers",
    label: "Signers & access",
    groupId: "infrastructure",
    groupLabel: GROUP_LABELS.infrastructure,
  },
  {
    id: "billing",
    label: "Billing",
    groupId: "billing",
    groupLabel: GROUP_LABELS.billing,
  },
] as const;

const LEGACY_TAB_ALIASES: Record<string, SettingsTabId> = {
  content: "publishing",
  network: "relays",
  storage: "media",
  subscription: "billing",
  referral: "billing",
};

const ALL_CANONICAL_IDS = new Set<SettingsTabId>(
  SECTIONS_ORDERED.map((s) => s.id)
);

/**
 * Map bookmarked ?tab= values to canonical ids (V3 and earlier).
 */
export function normalizeSettingsTabParam(
  tabParam: string | null
): SettingsTabId | null {
  if (!tabParam?.trim()) return null;
  const key = tabParam.trim();
  if (LEGACY_TAB_ALIASES[key]) {
    return LEGACY_TAB_ALIASES[key];
  }
  if (ALL_CANONICAL_IDS.has(key as SettingsTabId)) {
    return key as SettingsTabId;
  }
  return null;
}

/**
 * When normalizing `referral` → `billing`, prefer the referral segment.
 */
export function billingSegmentForNormalizedTab(
  rawTabParam: string | null,
  normalizedTab: SettingsTabId
): BillingSegmentId | null {
  if (normalizedTab !== "billing") return null;
  const raw = rawTabParam?.trim() ?? "";
  if (raw === "referral") return "referral";
  return null;
}

export function getVisibleSettingsSections(input: {
  isChild: boolean;
}): SettingsSectionDef[] {
  return SECTIONS_ORDERED.filter((s) => !(s.id === "billing" && input.isChild));
}

/**
 * Groups consecutive sections with the same groupId (preserves order).
 */
export function groupVisibleSettingsSections(
  sections: SettingsSectionDef[]
): Array<{
  groupId: SettingsSectionGroupId;
  groupLabel: string;
  items: SettingsSectionDef[];
}> {
  const out: Array<{
    groupId: SettingsSectionGroupId;
    groupLabel: string;
    items: SettingsSectionDef[];
  }> = [];
  for (const s of sections) {
    const last = out[out.length - 1];
    if (last?.groupId === s.groupId) {
      last.items.push(s);
    } else {
      out.push({
        groupId: s.groupId,
        groupLabel: s.groupLabel,
        items: [s],
      });
    }
  }
  return out;
}

/**
 * Legacy rules: child users cannot open billing.
 */
export function getSettingsDefaultTab(input: {
  tabParam: string | null;
  isChild: boolean;
}): SettingsTabId {
  const normalized = normalizeSettingsTabParam(input.tabParam);
  const requested: SettingsTabId = normalized ?? "general";

  if (input.isChild && requested === "billing") {
    return "general";
  }
  return requested;
}

export function resolveSettingsTab(input: {
  tabParam: string | null;
  isChild: boolean;
}): SettingsTabId {
  const visible = new Set(getVisibleSettingsSections(input).map((s) => s.id));
  const candidate = getSettingsDefaultTab(input);
  if (visible.has(candidate)) return candidate;
  return "general";
}

export function parseBillingSegmentParam(
  value: string | null
): BillingSegmentId {
  if (value === "payments" || value === "referral") return value;
  return "overview";
}
