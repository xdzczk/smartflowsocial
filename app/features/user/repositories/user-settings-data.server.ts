/**
 * User settings data access. All prisma.user.update and prisma.user.findUnique
 * for user settings live here. Prisma confined to this file.
 */

import { Prisma } from "@prisma/client";
import type { User, UploadProvider } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

/** Row returned by findUserForRunwayFallback (select used in updateRunwaySettings fallback). */
export interface UserRunwayFallbackRow {
  id: string;
  npub: string;
  createdAt: Date;
  updatedAt: Date;
  isEnabled: boolean;
  timezone: string | null;
  userRelays: string[];
  giveawayBlackListed: string[];
  uploadProvider: UploadProvider;
  customBlossomUrl: string | null;
  showHashTagsinPosts: boolean;
  scheduleInterval: string[];
  nostrProfile: unknown;
  enableMirrorBlossom: boolean;
  mirrorUploadUrls: string[];
  encryptedNwc: string | null;
  nwcEnabled: boolean;
  nwcLastUsed: Date | null;
  mutedList: unknown;
  filterMuted: boolean;
  hidePostsFromLowTrustUsers: boolean;
  pushNotificationsEnabled: boolean;
  pushNotifyPublishSuccess: boolean;
  pushNotifyPublishFailure: boolean;
  timeFormat: string | null;
  preferredNostrClient: string | null;
  customNostrClientBaseUrl: string | null;
  isChild: boolean;
  parentNpub: string | null;
  pendingParentRequests: string[];
  localeDefaultsAppliedAt: Date | null;
  primarySignerProfile: unknown;
  engagementLastCheckedAt: Date | null;
}

// --- Timezone ---
export function updateUserTimezoneRow(
  userId: string,
  timezone: string
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { timezone },
  });
}

export function findUserTimezoneRow(
  userId: string
): Promise<{ timezone: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
}

// --- Relays ---
export function updateUserRelaysRow(
  userId: string,
  relays: string[]
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { userRelays: relays },
  });
}

export function updateUserRelayPublishingPreferencesRow(
  userId: string,
  input: { userRelays: string[]; publishRelaySource: string }
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      userRelays: input.userRelays,
      publishRelaySource: input.publishRelaySource,
    },
  });
}

export function findUserRelaysRow(
  userId: string
): Promise<{ userRelays: string[] } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { userRelays: true },
  });
}

// --- Giveaway blacklist ---
export function updateGiveawayBlacklistRow(
  userId: string,
  blacklistedItems: string[]
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { giveawayBlackListed: blacklistedItems },
  });
}

export function findGiveawayBlacklistRow(
  userId: string
): Promise<{ giveawayBlackListed: string[] } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { giveawayBlackListed: true },
  });
}

// --- Schedule interval ---
export function updateScheduleIntervalRow(
  userId: string,
  intervals: string[]
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { scheduleInterval: intervals },
  });
}

export function findScheduleIntervalRow(
  userId: string
): Promise<{ scheduleInterval: string[] } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { scheduleInterval: true },
  });
}

// --- Upload provider ---
export function updateUserUploadProviderRow(
  userId: string,
  uploadProvider: UploadProvider
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { uploadProvider },
  });
}

export function findUserCustomBlossomUrlRow(
  userId: string
): Promise<{ customBlossomUrl: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { customBlossomUrl: true },
  });
}

export function updateUserCustomBlossomUrlRow(
  userId: string,
  customBlossomUrl: string | null
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { customBlossomUrl },
  });
}

export function updateUserUploadProviderSettingsRow(
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

export function findUserUploadProviderSettingsRow(userId: string): Promise<{
  uploadProvider: UploadProvider;
  customBlossomUrl: string | null;
} | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { uploadProvider: true, customBlossomUrl: true },
  });
}

// --- Mirror Blossom ---
export function findUserEnableMirrorBlossomRow(
  userId: string
): Promise<{ enableMirrorBlossom: boolean } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { enableMirrorBlossom: true },
  });
}

export function updateUserEnableMirrorBlossomRow(
  userId: string,
  enableMirrorBlossom: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { enableMirrorBlossom },
  });
}

export function findUserBlastrRelayEnabledRow(
  userId: string
): Promise<{ blastrRelayEnabled: boolean } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { blastrRelayEnabled: true },
  });
}

export function updateUserBlastrRelayEnabledRow(
  userId: string,
  blastrRelayEnabled: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { blastrRelayEnabled },
  });
}

export function findUserMirrorUploadUrlsRow(
  userId: string
): Promise<{ mirrorUploadUrls: string[] } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { mirrorUploadUrls: true },
  });
}

export function updateUserMirrorUploadUrlsRow(
  userId: string,
  mirrorUrls: string[]
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { mirrorUploadUrls: mirrorUrls },
  });
}

// --- Muted list ---
export function updateUserMutedListRow(
  userId: string,
  mutedList: { npubs: string[]; lastSynced: string }
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { mutedList },
  });
}

export function findUserMutedListRow(
  userId: string
): Promise<{ mutedList: unknown } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { mutedList: true },
  });
}

// --- Push notification preferences ---
export function findUserPushNotificationPreferencesRow(
  userId: string
): Promise<{
  pushNotificationsEnabled: boolean | null;
  pushNotifyPublishSuccess: boolean | null;
  pushNotifyPublishFailure: boolean | null;
  pushNotifyRunwayLow: boolean | null;
  pushNotifyIncludePreview: boolean | null;
  runwayNotifyBelowDays: number | null;
} | null> {
  return prisma.user.findUnique({
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
}

export function updateUserPushNotificationPreferencesRow(
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

// --- Filter muted ---
export function updateUserFilterMutedRow(
  userId: string,
  filterMuted: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { filterMuted },
  });
}

export function findUserFilterMutedRow(
  userId: string
): Promise<{ filterMuted: boolean } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { filterMuted: true },
  });
}

// --- Hide posts from low trust users ---
export function updateUserHidePostsFromLowTrustUsersRow(
  userId: string,
  hidePostsFromLowTrustUsers: boolean
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { hidePostsFromLowTrustUsers },
  });
}

export function findUserHidePostsFromLowTrustUsersRow(
  userId: string
): Promise<{ hidePostsFromLowTrustUsers: boolean } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { hidePostsFromLowTrustUsers: true },
  });
}

// --- Time format ---
export function findUserTimeFormatRow(
  userId: string
): Promise<{ timeFormat: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { timeFormat: true },
  });
}

export function updateUserTimeFormatRow(
  userId: string,
  timeFormat: "12h" | "24h"
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { timeFormat },
  });
}

// --- Primary signer profile ---
export function findUserPrimarySignerProfileRow(
  userId: string
): Promise<{ primarySignerProfile: unknown } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { primarySignerProfile: true },
  });
}

export function updateUserPrimarySignerProfileRow(
  userId: string,
  profile: unknown
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: {
      primarySignerProfile: profile as Prisma.InputJsonValue,
    },
  });
}

export function findUserByIdRow(userId: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id: userId },
  });
}

export function clearUserPrimarySignerProfileRow(
  userId: string
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { primarySignerProfile: Prisma.JsonNull },
  });
}

// --- Date format ---
export function findUserDateFormatRow(
  userId: string
): Promise<{ dateFormat: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { dateFormat: true },
  });
}

export function updateUserDateFormatRow(
  userId: string,
  dateFormat: string
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { dateFormat },
  });
}

// --- Preferred Nostr client ---
export function findUserPreferredNostrClientRow(
  userId: string
): Promise<{ preferredNostrClient: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { preferredNostrClient: true },
  });
}

export function findUserCustomNostrClientBaseUrlRow(
  userId: string
): Promise<{ customNostrClientBaseUrl: string | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { customNostrClientBaseUrl: true },
  });
}

export function updateUserPreferredNostrClientRow(
  userId: string,
  data: {
    preferredNostrClient: string;
    customNostrClientBaseUrl?: string | null;
  }
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}

// --- Engagement last checked ---
export function findEngagementLastCheckedAtRow(
  userId: string
): Promise<{ engagementLastCheckedAt: Date | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { engagementLastCheckedAt: true },
  });
}

export function updateEngagementLastCheckedAtRow(
  userId: string
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { engagementLastCheckedAt: new Date() },
  });
}

// --- Locale defaults ---
export function findLocaleDefaultsAppliedAtRow(
  userId: string
): Promise<{ localeDefaultsAppliedAt: Date | null } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { localeDefaultsAppliedAt: true },
  });
}

export function applyLocaleDefaultsOnceRow(
  userId: string,
  timeFormat: "12h" | "24h",
  dateFormat: string
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

// --- Runway settings ---
export function findUserRunwaySettingsRow(
  userId: string
): Promise<{ runwaySettings: unknown } | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { runwaySettings: true },
  });
}

export function updateRunwaySettingsRow(
  userId: string,
  settings: {
    queueNames: string[];
    mode: string;
    redThresholdDays: number;
    orangeThresholdDays: number;
    targetPostsPerDay: number;
  }
): Promise<User> {
  return prisma.user.update({
    where: { id: userId },
    data: { runwaySettings: settings },
  });
}

export function findUserForRunwayFallbackRow(
  userId: string
): Promise<UserRunwayFallbackRow | null> {
  return prisma.user.findUnique({
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
      preferredNostrClient: true,
      customNostrClientBaseUrl: true,
      isChild: true,
      parentNpub: true,
      pendingParentRequests: true,
      localeDefaultsAppliedAt: true,
      primarySignerProfile: true,
      engagementLastCheckedAt: true,
    },
  });
}
