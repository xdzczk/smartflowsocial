import type { User, UploadProvider } from "@prisma/client";

import type { MutedListData } from "~/features/engagement/types";
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

/**
 * Gets user's upload provider
 * Handles legacy BLOSSOM value by converting to BLOSSOM_PRIMAL
 */
export async function getUserUploadProvider(
  userId: string
): Promise<UploadProvider> {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      uploadProvider: true,
    },
  });

  // Handle legacy BLOSSOM value by converting to BLOSSOM_PRIMAL
  const provider = user?.uploadProvider ?? "S3";
  // Check for legacy string value (not in enum) - compare as string
  const providerStr = String(provider);
  if (providerStr === "BLOSSOM") {
    return "BLOSSOM_PRIMAL";
  }
  return provider;
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
export async function getUserPushNotificationPreferences(
  userId: string
): Promise<{
  pushNotificationsEnabled: boolean;
  pushNotifyPublishSuccess: boolean;
  pushNotifyPublishFailure: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      pushNotificationsEnabled: true,
      pushNotifyPublishSuccess: true,
      pushNotifyPublishFailure: true,
    },
  });

  return {
    pushNotificationsEnabled: user?.pushNotificationsEnabled ?? true,
    pushNotifyPublishSuccess: user?.pushNotifyPublishSuccess ?? true,
    pushNotifyPublishFailure: user?.pushNotifyPublishFailure ?? true,
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
