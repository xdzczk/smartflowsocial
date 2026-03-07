import { Prisma } from "@prisma/client";
import type { User, UploadProvider } from "@prisma/client";

import type { MutedListData } from "~/features/engagement/types";
import { isSubscriptionActiveForGating } from "~/features/payments/subscriptions.server";
import {
  isPrimarySignerProfile,
  type PrimarySignerProfile,
} from "~/lib/primary-signer-profile";
import { prisma } from "~/lib/prisma.server";

/**
 * Updates user's timezone
 */
export function updateUserTimezone(
  userId: string,
  timezone: string
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      timezone: timezone,
    },
  });
}

/**
 * Gets user's timezone
 */
export async function getUserTimezone(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      timezone: true,
    },
  });
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
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      userRelays: relays,
    },
  });
}

/**
 * Gets user's persisted relay intent (write relays only).
 *
 * Managed relays (e.g. Blastr) are NOT injected here; callers that need publish
 * relays must use the canonical resolver in `app/features/relays/relay-resolution.server.ts`.
 */
export async function getUserRelays(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      userRelays: true,
    },
  });

  return user?.userRelays ?? [];
}

/**
 * Updates user's giveaway blacklist
 */
export function updateGiveawayBlacklist(
  userId: string,
  blacklistedItems: string[]
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      giveawayBlackListed: blacklistedItems,
    },
  });
}

/**
 * Gets user's giveaway blacklist
 */
export async function getGiveawayBlacklist(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      giveawayBlackListed: true,
    },
  });
  return user?.giveawayBlackListed ?? [];
}

/**
 * Updates user's schedule intervals
 */
export function updateScheduleInterval(
  userId: string,
  intervals: string[]
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      scheduleInterval: intervals,
    },
  });
}

/**
 * Gets user's schedule intervals
 */
export async function getScheduleInterval(userId: string): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      scheduleInterval: true,
    },
  });
  return user?.scheduleInterval ?? [];
}

/**
 * Updates user's upload provider
 */
export function updateUserUploadProvider(
  userId: string,
  uploadProvider: UploadProvider
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      uploadProvider: uploadProvider,
    },
  });
}

function resolveFallbackBlossomProvider(isPaidActive: boolean): UploadProvider {
  return isPaidActive ? "BLOSSOM_SFS" : "BLOSSOM_PRIMAL";
}

function normalizeLegacyUploadProvider(
  provider: string | null | undefined
): UploadProvider | "BLOSSOM" | null {
  if (!provider) {
    return null;
  }

  const providerStr = String(provider);
  if (providerStr === "BLOSSOM") {
    return "BLOSSOM";
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
  const normalized = normalizeLegacyUploadProvider(params.persistedProvider);

  // Preserve explicit Blossom choices.
  if (
    normalized === "BLOSSOM_PRIMAL" ||
    normalized === "BLOSSOM_BLOSSTR" ||
    normalized === "BLOSSOM_SFS" ||
    normalized === "BLOSSOM_CUSTOM"
  ) {
    return normalized;
  }

  // Legacy plain "BLOSSOM" maps to Primal.
  if (normalized === "BLOSSOM") {
    return "BLOSSOM_PRIMAL";
  }

  // Legacy/implicit S3 (or missing) resolves by tier defaults.
  return resolveFallbackBlossomProvider(params.isPaidActive);
}

/**
 * Gets user's upload provider
 * Resolves legacy and tier defaults:
 * - explicit Blossom choice wins
 * - legacy BLOSSOM => BLOSSOM_PRIMAL
 * - S3/missing => tier default (free => BLOSSOM_PRIMAL, paid => BLOSSOM_SFS)
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { customBlossomUrl: true },
  });
  return user?.customBlossomUrl ?? null;
}

export function updateUserCustomBlossomUrl(
  userId: string,
  customBlossomUrl: string | null
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { customBlossomUrl },
  });
}

export async function updateUserUploadProviderSettings(
  userId: string,
  uploadProvider: UploadProvider,
  customBlossomUrl: string | null
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      uploadProvider,
      customBlossomUrl:
        uploadProvider === "BLOSSOM_CUSTOM" ? customBlossomUrl : null,
    },
  });
}

export async function getResolvedUploadProviderSettings(
  userId: string
): Promise<{
  provider: UploadProvider;
  customBlossomUrl: string | null;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      uploadProvider: true,
      customBlossomUrl: true,
    },
  });
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
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      enableMirrorBlossom: true,
    },
  });
  return user?.enableMirrorBlossom ?? false;
}

/**
 * Updates whether user has mirror Blossom enabled
 */
export function updateUserEnableMirrorBlossom(
  userId: string,
  enableMirrorBlossom: boolean
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      enableMirrorBlossom: enableMirrorBlossom,
    },
  });
}

/**
 * Gets user's mirror upload URLs
 */
export async function getUserMirrorUploadUrls(
  userId: string
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      mirrorUploadUrls: true,
    },
  });
  return user?.mirrorUploadUrls ?? [];
}

/**
 * Updates user's mirror upload URLs
 */
export function updateUserMirrorUploadUrls(
  userId: string,
  mirrorUrls: string[]
): Promise<User> {
  return prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      mirrorUploadUrls: mirrorUrls,
    },
  });
}

/**
 * Updates user's muted list
 */
export function updateUserMutedList(
  userId: string,
  mutedList: { npubs: string[]; lastSynced: string }
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      mutedList: mutedList,
    },
  });
}

/**
 * Gets user's muted list
 */
export async function getUserMutedList(userId: string): Promise<{
  npubs: string[];
  lastSynced: string;
} | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mutedList: true },
  });

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
export { getUserIdWithRunwayLowNotificationEnabled } from "~/models/user-notifications.server";

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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pushNotificationsEnabled: true,
      pushNotifyPublishSuccess: true,
      pushNotifyPublishFailure: true,
      pushNotifyRunwayLow: true,
      pushNotifyIncludePreview: true,
      runwayNotifyBelowDays: true,
    },
  });

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
  return prisma.user.update({
    where: { id: userId },
    data: {
      ...(preferences.pushNotificationsEnabled !== undefined && {
        pushNotificationsEnabled: preferences.pushNotificationsEnabled,
      }),
      ...(preferences.pushNotifyPublishSuccess !== undefined && {
        pushNotifyPublishSuccess: preferences.pushNotifyPublishSuccess,
      }),
      ...(preferences.pushNotifyPublishFailure !== undefined && {
        pushNotifyPublishFailure: preferences.pushNotifyPublishFailure,
      }),
      ...(preferences.pushNotifyRunwayLow !== undefined && {
        pushNotifyRunwayLow: preferences.pushNotifyRunwayLow,
      }),
      ...(preferences.pushNotifyIncludePreview !== undefined && {
        pushNotifyIncludePreview: preferences.pushNotifyIncludePreview,
      }),
      ...(preferences.runwayNotifyBelowDays !== undefined && {
        runwayNotifyBelowDays: preferences.runwayNotifyBelowDays,
      }),
    },
  });
}

/**
 * Updates the filterMuted setting
 */
export function updateUserFilterMuted(
  userId: string,
  filterMuted: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      filterMuted: filterMuted,
    },
  });
}

/**
 * Gets the filterMuted setting
 */
export async function getUserFilterMuted(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { filterMuted: true },
  });
  return user?.filterMuted ?? false;
}

/**
 * Updates the hidePostsFromLowTrustUsers setting
 */
export function updateUserHidePostsFromLowTrustUsers(
  userId: string,
  hidePostsFromLowTrustUsers: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      hidePostsFromLowTrustUsers: hidePostsFromLowTrustUsers,
    },
  });
}

/**
 * Gets the hidePostsFromLowTrustUsers setting
 */
export async function getUserHidePostsFromLowTrustUsers(
  userId: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hidePostsFromLowTrustUsers: true },
  });
  return user?.hidePostsFromLowTrustUsers ?? false;
}

/**
 * Gets user's time format preference
 */
export async function getUserTimeFormat(
  userId: string
): Promise<"12h" | "24h"> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timeFormat: true },
  });
  return user?.timeFormat === "12h" ? "12h" : "24h";
}

/**
 * Updates user's time format preference
 */
export function updateUserTimeFormat(
  userId: string,
  timeFormat: "12h" | "24h"
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      timeFormat: timeFormat,
    },
  });
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { primarySignerProfile: true },
    });
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
    return await prisma.user.update({
      where: { id: userId },
      data: {
        primarySignerProfile: profile,
      },
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
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
    return await prisma.user.update({
      where: { id: userId },
      data: {
        primarySignerProfile: Prisma.JsonNull,
      },
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
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
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dateFormat: true },
  });
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
  return prisma.user.update({
    where: { id: userId },
    data: {
      dateFormat: dateFormat,
    },
  });
}

/**
 * Returns when the user last opened the Engagement Feed, or null if never.
 * Used for time-based "unread" (items newer than this are unread).
 */
export async function getEngagementLastCheckedAt(
  userId: string
): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { engagementLastCheckedAt: true },
  });
  return user?.engagementLastCheckedAt ?? null;
}

/**
 * Sets the user's last Engagement Feed check time to now.
 * Call when the user opens the feed (e.g. loader for page 1).
 */
export function updateEngagementLastCheckedAt(userId: string): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { engagementLastCheckedAt: new Date() },
  });
}

/**
 * Returns when locale defaults were applied for this user, or null if never.
 * Used to run "apply device locale" only once ever per user.
 */
export async function getLocaleDefaultsAppliedAt(
  userId: string
): Promise<Date | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { localeDefaultsAppliedAt: true },
  });
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
  return prisma.user.update({
    where: { id: userId },
    data: {
      timeFormat,
      dateFormat,
      localeDefaultsAppliedAt: new Date(),
    },
  });
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
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { runwaySettings: true },
    });
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
    return await prisma.user.update({
      where: { id: userId },
      data: {
        runwaySettings: {
          queueNames: settings.queueNames,
          mode: settings.mode,
          redThresholdDays:
            settings.redThresholdDays ?? DEFAULT_RED_THRESHOLD_DAYS,
          orangeThresholdDays:
            settings.orangeThresholdDays ?? DEFAULT_ORANGE_THRESHOLD_DAYS,
          targetPostsPerDay:
            settings.targetPostsPerDay ?? DEFAULT_TARGET_POSTS_PER_DAY,
        },
      },
    });
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err ? err.code : null;
    if (
      code === "P2022" ||
      (err instanceof Error &&
        err.message.includes(COLUMN_MISSING_ERROR_FRAGMENT))
    ) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          npub: true,
          createdAt: true,
          updatedAt: true,
          isEnabled: true,
          timezone: true,
          userRelays: true,
          giveawayBlackListed: true,
          uploadProvider: true,
          customBlossomUrl: true,
          showHashTagsinPosts: true,
          scheduleInterval: true,
          nostrProfile: true,
          enableMirrorBlossom: true,
          mirrorUploadUrls: true,
          encryptedNwc: true,
          nwcEnabled: true,
          nwcLastUsed: true,
          mutedList: true,
          filterMuted: true,
          hidePostsFromLowTrustUsers: true,
          pushNotificationsEnabled: true,
          pushNotifyPublishSuccess: true,
          pushNotifyPublishFailure: true,
          timeFormat: true,
          isChild: true,
          parentNpub: true,
          pendingParentRequests: true,
          localeDefaultsAppliedAt: true,
          primarySignerProfile: true,
          engagementLastCheckedAt: true,
        },
      });
      if (!user) throw err;
      const result: User = {
        ...user,
        runwaySettings: null,
        primarySignerProfile: null,
        pushNotifyRunwayLow: false,
        pushNotifyIncludePreview: true,
        runwayNotifyBelowDays: null,
        lastRunwayLowNotificationAt: null,
        dateFormat: null,
      };
      return result;
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
