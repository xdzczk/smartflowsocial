import {
  isPrimarySignerProfile,
  type PrimarySignerProfile,
} from "~/features/auth/signer";
import type { MutedListData } from "~/features/engagement/types";
import { isSubscriptionActiveForGating } from "~/features/payments/subscriptions.server";
import type {
  User,
  UploadProvider,
} from "~/features/user/data/user-prisma-types.server";
import {
  updateUserTimezoneRow,
  findUserTimezoneRow,
  updateUserRelaysRow,
  findUserRelaysRow,
  updateGiveawayBlacklistRow,
  findGiveawayBlacklistRow,
  updateScheduleIntervalRow,
  findScheduleIntervalRow,
  updateUserUploadProviderRow,
  findUserCustomBlossomUrlRow,
  updateUserCustomBlossomUrlRow,
  updateUserUploadProviderSettingsRow,
  findUserUploadProviderSettingsRow,
  findUserEnableMirrorBlossomRow,
  updateUserEnableMirrorBlossomRow,
  findUserMirrorUploadUrlsRow,
  updateUserMirrorUploadUrlsRow,
  updateUserMutedListRow,
  findUserMutedListRow,
  findUserPushNotificationPreferencesRow,
  updateUserPushNotificationPreferencesRow,
  updateUserFilterMutedRow,
  findUserFilterMutedRow,
  updateUserHidePostsFromLowTrustUsersRow,
  findUserHidePostsFromLowTrustUsersRow,
  findUserTimeFormatRow,
  updateUserTimeFormatRow,
  findUserPrimarySignerProfileRow,
  updateUserPrimarySignerProfileRow,
  findUserByIdRow,
  clearUserPrimarySignerProfileRow,
  findUserDateFormatRow,
  updateUserDateFormatRow,
  findUserPreferredNostrClientRow,
  findUserCustomNostrClientBaseUrlRow,
  updateUserPreferredNostrClientRow,
  findEngagementLastCheckedAtRow,
  updateEngagementLastCheckedAtRow,
  findLocaleDefaultsAppliedAtRow,
  applyLocaleDefaultsOnceRow,
  findUserRunwaySettingsRow,
  updateRunwaySettingsRow,
  findUserForRunwayFallbackRow,
} from "~/features/user/repositories/user-settings-data.server";

/**
 * Updates user's timezone
 */
export function updateUserTimezone(
  userId: string,
  timezone: string
): Promise<User> {
  return updateUserTimezoneRow(userId, timezone);
}

/**
 * Gets user's timezone
 */
export async function getUserTimezone(userId: string): Promise<string | null> {
  const user = await findUserTimezoneRow(userId);
  return user?.timezone ?? null;
}

/**
 * Updates user's Nostr relays
 * Note: This is persisted relay intent only; managed relays are resolved separately.
 */
export function updateUserRelays(
  userId: string,
  relays: string[]
): Promise<User> {
  return updateUserRelaysRow(userId, relays);
}

/**
 * Gets user's persisted relay intent (write relays only).
 *
 * Managed relays (e.g. Blastr) are NOT injected here; callers that need publish
 * relays must use the canonical resolver in `app/features/relays/relay-resolution.server.ts`.
 */
export async function getUserRelays(userId: string): Promise<string[]> {
  const user = await findUserRelaysRow(userId);
  return user?.userRelays ?? [];
}

/**
 * Updates user's giveaway blacklist
 */
export function updateGiveawayBlacklist(
  userId: string,
  blacklistedItems: string[]
): Promise<User> {
  return updateGiveawayBlacklistRow(userId, blacklistedItems);
}

/**
 * Gets user's giveaway blacklist
 */
export async function getGiveawayBlacklist(userId: string): Promise<string[]> {
  const user = await findGiveawayBlacklistRow(userId);
  return user?.giveawayBlackListed ?? [];
}

/**
 * Updates user's schedule intervals
 */
export function updateScheduleInterval(
  userId: string,
  intervals: string[]
): Promise<User> {
  return updateScheduleIntervalRow(userId, intervals);
}

/**
 * Gets user's schedule intervals
 */
export async function getScheduleInterval(userId: string): Promise<string[]> {
  const user = await findScheduleIntervalRow(userId);
  return user?.scheduleInterval ?? [];
}

/**
 * Updates user's upload provider
 */
export function updateUserUploadProvider(
  userId: string,
  uploadProvider: UploadProvider
): Promise<User> {
  return updateUserUploadProviderRow(userId, uploadProvider);
}

function resolveFallbackBlossomProvider(isPaidActive: boolean): UploadProvider {
  return isPaidActive ? "BLOSSOM_SFS" : "BLOSSOM_PRIMAL";
}

function normalizeUploadProvider(
  provider: string | null | undefined
): UploadProvider | null {
  if (!provider) {
    return null;
  }

  const providerStr = String(provider);
  if (providerStr === "BLOSSOM") {
    return "BLOSSOM_PRIMAL";
  }
  if (
    providerStr === "S3" ||
    providerStr === "BLOSSOM_PRIMAL" ||
    providerStr === "BLOSSOM_BLOSSTR" ||
    providerStr === "BLOSSOM_SFS" ||
    providerStr === "BLOSSOM_CUSTOM"
  ) {
    return providerStr;
  }
  return null;
}

export function resolveUploadProviderWithTierDefaults(params: {
  persistedProvider: string | null | undefined;
  isPaidActive: boolean;
}): UploadProvider {
  const normalized = normalizeUploadProvider(params.persistedProvider);

  if (
    normalized === "BLOSSOM_PRIMAL" ||
    normalized === "BLOSSOM_BLOSSTR" ||
    normalized === "BLOSSOM_SFS" ||
    normalized === "BLOSSOM_CUSTOM"
  ) {
    return normalized;
  }

  return resolveFallbackBlossomProvider(params.isPaidActive);
}

/**
 * Gets user's upload provider.
 * Explicit Blossom choice wins; S3/missing resolves by tier default (free => BLOSSOM_PRIMAL, paid => BLOSSOM_SFS).
 */
export async function getUserUploadProvider(
  userId: string
): Promise<UploadProvider> {
  const settings = await getResolvedUploadProviderSettings(userId);
  return settings.provider;
}

export async function getUserCustomBlossomUrl(
  userId: string
): Promise<string | null> {
  const user = await findUserCustomBlossomUrlRow(userId);
  return user?.customBlossomUrl ?? null;
}

export function updateUserCustomBlossomUrl(
  userId: string,
  customBlossomUrl: string | null
): Promise<User> {
  return updateUserCustomBlossomUrlRow(userId, customBlossomUrl);
}

export async function updateUserUploadProviderSettings(
  userId: string,
  uploadProvider: UploadProvider,
  customBlossomUrl: string | null
): Promise<User> {
  return updateUserUploadProviderSettingsRow(
    userId,
    uploadProvider,
    uploadProvider === "BLOSSOM_CUSTOM" ? customBlossomUrl : null
  );
}

export async function getResolvedUploadProviderSettings(
  userId: string
): Promise<{
  provider: UploadProvider;
  customBlossomUrl: string | null;
}> {
  const user = await findUserUploadProviderSettingsRow(userId);
  const isPaidActive = await isSubscriptionActiveForGating(userId);
  const resolvedProvider = resolveUploadProviderWithTierDefaults({
    persistedProvider: user?.uploadProvider ?? null,
    isPaidActive,
  });
  const customBlossomUrl = user?.customBlossomUrl ?? null;
  const provider =
    resolvedProvider === "BLOSSOM_CUSTOM" && !customBlossomUrl
      ? resolveFallbackBlossomProvider(isPaidActive)
      : resolvedProvider;

  return {
    provider,
    customBlossomUrl,
  };
}

/**
 * Gets whether user has mirror Blossom enabled
 */
export async function getUserEnableMirrorBlossom(
  userId: string
): Promise<boolean> {
  const user = await findUserEnableMirrorBlossomRow(userId);
  return user?.enableMirrorBlossom ?? false;
}

/**
 * Updates whether user has mirror Blossom enabled
 */
export function updateUserEnableMirrorBlossom(
  userId: string,
  enableMirrorBlossom: boolean
): Promise<User> {
  return updateUserEnableMirrorBlossomRow(userId, enableMirrorBlossom);
}

/**
 * Gets user's mirror upload URLs
 */
export async function getUserMirrorUploadUrls(
  userId: string
): Promise<string[]> {
  const user = await findUserMirrorUploadUrlsRow(userId);
  return user?.mirrorUploadUrls ?? [];
}

/**
 * Updates user's mirror upload URLs
 */
export function updateUserMirrorUploadUrls(
  userId: string,
  mirrorUrls: string[]
): Promise<User> {
  return updateUserMirrorUploadUrlsRow(userId, mirrorUrls);
}

/**
 * Updates user's muted list
 */
export function updateUserMutedList(
  userId: string,
  mutedList: { npubs: string[]; lastSynced: string }
): Promise<User> {
  return updateUserMutedListRow(userId, mutedList);
}

/**
 * Gets user's muted list
 */
export async function getUserMutedList(userId: string): Promise<{
  npubs: string[];
  lastSynced: string;
} | null> {
  const user = await findUserMutedListRow(userId);

  if (!user?.mutedList) {
    return null;
  }

  // Handle JSON parsing - mutedList is stored as Json in Prisma
  const mutedList = user.mutedList as unknown as MutedListData | null;
  if (!mutedList || typeof mutedList !== "object") {
    return null;
  }

  return {
    npubs: Array.isArray(mutedList.npubs) ? mutedList.npubs : [],
    lastSynced:
      typeof mutedList.lastSynced === "string"
        ? mutedList.lastSynced
        : new Date().toISOString(),
  };
}

/**
 * Gets user's push notification preferences
 */
export { getUserIdWithRunwayLowNotificationEnabled } from "~/features/user/services/user-notifications.server";

export async function getUserPushNotificationPreferences(
  userId: string
): Promise<{
  pushNotificationsEnabled: boolean;
  pushNotifyPublishSuccess: boolean;
  pushNotifyPublishFailure: boolean;
  pushNotifyRunwayLow: boolean;
  pushNotifyIncludePreview: boolean;
  runwayNotifyBelowDays: number | null;
}> {
  const user = await findUserPushNotificationPreferencesRow(userId);

  return {
    pushNotificationsEnabled: user?.pushNotificationsEnabled ?? true,
    pushNotifyPublishSuccess: user?.pushNotifyPublishSuccess ?? true,
    pushNotifyPublishFailure: user?.pushNotifyPublishFailure ?? true,
    pushNotifyRunwayLow: user?.pushNotifyRunwayLow ?? false,
    pushNotifyIncludePreview: user?.pushNotifyIncludePreview ?? true,
    runwayNotifyBelowDays: user?.runwayNotifyBelowDays ?? null,
  };
}

/**
 * Updates push notification preferences
 */
export async function updateUserPushNotificationPreferences(
  userId: string,
  preferences: {
    pushNotificationsEnabled?: boolean;
    pushNotifyPublishSuccess?: boolean;
    pushNotifyPublishFailure?: boolean;
    pushNotifyRunwayLow?: boolean;
    pushNotifyIncludePreview?: boolean;
    runwayNotifyBelowDays?: number | null;
  }
): Promise<User> {
  return updateUserPushNotificationPreferencesRow(userId, preferences);
}

/**
 * Updates the filterMuted setting
 */
export function updateUserFilterMuted(
  userId: string,
  filterMuted: boolean
): Promise<User> {
  return updateUserFilterMutedRow(userId, filterMuted);
}

/**
 * Gets the filterMuted setting
 */
export async function getUserFilterMuted(userId: string): Promise<boolean> {
  const user = await findUserFilterMutedRow(userId);
  return user?.filterMuted ?? false;
}

/**
 * Updates the hidePostsFromLowTrustUsers setting
 */
export function updateUserHidePostsFromLowTrustUsers(
  userId: string,
  hidePostsFromLowTrustUsers: boolean
): Promise<User> {
  return updateUserHidePostsFromLowTrustUsersRow(
    userId,
    hidePostsFromLowTrustUsers
  );
}

/**
 * Gets the hidePostsFromLowTrustUsers setting
 */
export async function getUserHidePostsFromLowTrustUsers(
  userId: string
): Promise<boolean> {
  const user = await findUserHidePostsFromLowTrustUsersRow(userId);
  return user?.hidePostsFromLowTrustUsers ?? false;
}

/**
 * Gets user's time format preference
 */
export async function getUserTimeFormat(
  userId: string
): Promise<"12h" | "24h"> {
  const user = await findUserTimeFormatRow(userId);
  return user?.timeFormat === "12h" ? "12h" : "24h";
}

/**
 * Updates user's time format preference
 */
export function updateUserTimeFormat(
  userId: string,
  timeFormat: "12h" | "24h"
): Promise<User> {
  return updateUserTimeFormatRow(userId, timeFormat);
}

export type DateFormatKey = "ddmmyyyy" | "mmddyyyy" | "yyyymmdd";
const COLUMN_MISSING_ERROR_FRAGMENT = "does not exist";

/**
 * Gets account-level primary NIP-46 signer profile metadata.
 * Returns null when no profile exists or when DB column is not migrated yet.
 */
export async function getUserPrimarySignerProfile(
  userId: string
): Promise<PrimarySignerProfile | null> {
  try {
    const user = await findUserPrimarySignerProfileRow(userId);
    const raw = user?.primarySignerProfile;
    return isPrimarySignerProfile(raw) ? raw : null;
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      return null;
    }
    throw err;
  }
}

/**
 * Upserts account-level primary NIP-46 signer profile metadata.
 * No per-device secrets are stored server-side.
 */
export async function updateUserPrimarySignerProfile(
  userId: string,
  profile: PrimarySignerProfile
): Promise<User> {
  try {
    return await updateUserPrimarySignerProfileRow(userId, profile);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      const user = await findUserByIdRow(userId);
      if (!user) throw err;
      return user;
    }
    throw err;
  }
}

/**
 * Clears account-level primary NIP-46 signer profile metadata.
 */
export async function clearUserPrimarySignerProfile(
  userId: string
): Promise<User> {
  try {
    return await clearUserPrimarySignerProfileRow(userId);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      const user = await findUserByIdRow(userId);
      if (!user) throw err;
      return user;
    }
    throw err;
  }
}

/**
 * Gets user's date format preference
 */
export async function getUserDateFormat(
  userId: string
): Promise<DateFormatKey> {
  const user = await findUserDateFormatRow(userId);
  const v = user?.dateFormat;
  if (v === "mmddyyyy" || v === "yyyymmdd") return v;
  return "ddmmyyyy";
}

/**
 * Updates user's date format preference
 */
export function updateUserDateFormat(
  userId: string,
  dateFormat: DateFormatKey
): Promise<User> {
  return updateUserDateFormatRow(userId, dateFormat);
}

export const PREFERRED_NOSTR_CLIENT_PRESETS = [
  "PRIMAL",
  "DAMUS",
  "AMETHYST",
  "NOSTUR",
  "NOSTRUDEL",
  "IRIS",
  "YAKIHONNE",
  "CUSTOM",
] as const;
export type PreferredNostrClientPreset =
  (typeof PREFERRED_NOSTR_CLIENT_PRESETS)[number];

/**
 * Gets user's preferred Nostr client for "View note/article" links.
 */
export async function getUserPreferredNostrClient(
  userId: string
): Promise<PreferredNostrClientPreset> {
  const user = await findUserPreferredNostrClientRow(userId);
  const v = user?.preferredNostrClient;
  if (
    v &&
    PREFERRED_NOSTR_CLIENT_PRESETS.includes(v as PreferredNostrClientPreset)
  ) {
    return v as PreferredNostrClientPreset;
  }
  return "PRIMAL";
}

/**
 * Gets user's custom Nostr client base URL (when preferredNostrClient is CUSTOM).
 */
export async function getUserCustomNostrClientBaseUrl(
  userId: string
): Promise<string | null> {
  const user = await findUserCustomNostrClientBaseUrlRow(userId);
  const v = user?.customNostrClientBaseUrl;
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Updates user's preferred Nostr client and optional custom base URL.
 */
export function updateUserPreferredNostrClient(
  userId: string,
  preferredNostrClient: PreferredNostrClientPreset,
  customNostrClientBaseUrl?: string | null
): Promise<User> {
  const data: {
    preferredNostrClient: string;
    customNostrClientBaseUrl?: string | null;
  } = {
    preferredNostrClient,
  };
  if (preferredNostrClient === "CUSTOM" && customNostrClientBaseUrl != null) {
    const url = customNostrClientBaseUrl.trim();
    data.customNostrClientBaseUrl = url !== "" ? url : null;
  } else {
    data.customNostrClientBaseUrl = null;
  }
  return updateUserPreferredNostrClientRow(userId, data);
}

/**
 * Returns when the user last opened the Engagement Feed, or null if never.
 * Used for time-based "unread" (items newer than this are unread).
 */
export async function getEngagementLastCheckedAt(
  userId: string
): Promise<Date | null> {
  const user = await findEngagementLastCheckedAtRow(userId);
  return user?.engagementLastCheckedAt ?? null;
}

/**
 * Sets the user's last Engagement Feed check time to now.
 * Call when the user opens the feed (e.g. loader for page 1).
 */
export function updateEngagementLastCheckedAt(userId: string): Promise<User> {
  return updateEngagementLastCheckedAtRow(userId);
}

/**
 * Returns when locale defaults were applied for this user, or null if never.
 * Used to run "apply device locale" only once ever per user.
 */
export async function getLocaleDefaultsAppliedAt(
  userId: string
): Promise<Date | null> {
  const user = await findLocaleDefaultsAppliedAtRow(userId);
  return user?.localeDefaultsAppliedAt ?? null;
}

/**
 * Applies time/date format from device locale and marks that we've applied once.
 * Call only when user is still on app defaults and localeDefaultsAppliedAt is null.
 */
export function applyLocaleDefaultsOnce(
  userId: string,
  timeFormat: "12h" | "24h",
  dateFormat: DateFormatKey
): Promise<User> {
  return applyLocaleDefaultsOnceRow(userId, timeFormat, dateFormat);
}

export type RunwayMode = "last-post" | "first-queue-empty";

/** Days thresholds for KPI color: red when runway ≤ redThresholdDays, orange when ≤ orangeThresholdDays, amber otherwise. */
export interface RunwaySettings {
  queueNames: string[];
  mode: RunwayMode;
  /** Red when runway ≤ this (default 3). */
  redThresholdDays?: number;
  /** Orange when runway ≤ this (default 7); must be ≥ redThresholdDays. */
  orangeThresholdDays?: number;
  /** Target posts per day for schedule overview (Next 7 days); 0 = off, highlight only empty days. */
  targetPostsPerDay?: number;
}

const DEFAULT_RED_THRESHOLD_DAYS = 3;
const DEFAULT_ORANGE_THRESHOLD_DAYS = 7;

const DEFAULT_TARGET_POSTS_PER_DAY = 1;

const DEFAULT_RUNWAY_SETTINGS: RunwaySettings = {
  queueNames: [],
  mode: "last-post",
  redThresholdDays: DEFAULT_RED_THRESHOLD_DAYS,
  orangeThresholdDays: DEFAULT_ORANGE_THRESHOLD_DAYS,
  targetPostsPerDay: DEFAULT_TARGET_POSTS_PER_DAY,
};

/**
 * Gets user's runway KPI settings.
 * Empty queueNames means "all queues". Default mode is "last-post".
 * Returns defaults if the runwaySettings column is not yet present (migration not applied).
 */
export async function getRunwaySettings(
  userId: string
): Promise<RunwaySettings> {
  try {
    const user = await findUserRunwaySettingsRow(userId);
    const raw = user?.runwaySettings;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return { ...DEFAULT_RUNWAY_SETTINGS };
    }
    const obj = raw as Record<string, unknown>;
    const queueNames = Array.isArray(obj["queueNames"])
      ? (obj["queueNames"] as string[]).filter((n) => typeof n === "string")
      : [];
    const mode =
      obj["mode"] === "first-queue-empty" ? "first-queue-empty" : "last-post";
    const redThresholdDays =
      typeof obj["redThresholdDays"] === "number" &&
      Number.isInteger(obj["redThresholdDays"]) &&
      obj["redThresholdDays"] >= 0
        ? obj["redThresholdDays"]
        : DEFAULT_RED_THRESHOLD_DAYS;
    const orangeThresholdDays =
      typeof obj["orangeThresholdDays"] === "number" &&
      Number.isInteger(obj["orangeThresholdDays"]) &&
      obj["orangeThresholdDays"] >= 0
        ? obj["orangeThresholdDays"]
        : DEFAULT_ORANGE_THRESHOLD_DAYS;
    const targetPostsPerDay =
      typeof obj["targetPostsPerDay"] === "number" &&
      Number.isInteger(obj["targetPostsPerDay"]) &&
      obj["targetPostsPerDay"] >= 0 &&
      obj["targetPostsPerDay"] <= 10
        ? obj["targetPostsPerDay"]
        : DEFAULT_TARGET_POSTS_PER_DAY;
    return {
      queueNames,
      mode,
      redThresholdDays,
      orangeThresholdDays,
      targetPostsPerDay,
    };
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      return { ...DEFAULT_RUNWAY_SETTINGS };
    }
    throw err;
  }
}

/**
 * Updates user's runway KPI settings.
 * No-ops and returns the user if the runwaySettings column is not yet present (migration not applied).
 */
export async function updateRunwaySettings(
  userId: string,
  settings: RunwaySettings
): Promise<User> {
  try {
    return await updateRunwaySettingsRow(userId, {
      queueNames: settings.queueNames,
      mode: settings.mode,
      redThresholdDays: settings.redThresholdDays ?? DEFAULT_RED_THRESHOLD_DAYS,
      orangeThresholdDays:
        settings.orangeThresholdDays ?? DEFAULT_ORANGE_THRESHOLD_DAYS,
      targetPostsPerDay:
        settings.targetPostsPerDay ?? DEFAULT_TARGET_POSTS_PER_DAY,
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      const user = await findUserForRunwayFallbackRow(userId);
      if (!user) throw err;
      const result = {
        ...user,
        runwaySettings: null,
        primarySignerProfile: null,
        pushNotifyRunwayLow: false,
        pushNotifyIncludePreview: true,
        runwayNotifyBelowDays: null,
        lastRunwayLowNotificationAt: null,
        dateFormat: null,
      };
      return result as User;
    }
    throw err;
  }
}

/**
 * Updates only the schedule overview target (target posts per day for Next 7 days card).
 * Merges into current runway settings so other runway fields are unchanged.
 */
export async function updateScheduleOverviewTarget(
  userId: string,
  targetPostsPerDay: number
): Promise<User> {
  const current = await getRunwaySettings(userId);
  return updateRunwaySettings(userId, {
    ...current,
    targetPostsPerDay,
  });
}
