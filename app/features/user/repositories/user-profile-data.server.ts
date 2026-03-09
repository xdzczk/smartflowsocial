/**
 * User profile data access. Prisma confined to feature repositories/ per architecture.
 */

import type { User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

const USER_SCALAR_SELECT = {
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
  pushNotifyRunwayLow: true,
  pushNotifyIncludePreview: true,
  runwayNotifyBelowDays: true,
  lastRunwayLowNotificationAt: true,
  timeFormat: true,
  dateFormat: true,
  preferredNostrClient: true,
  customNostrClientBaseUrl: true,
  isChild: true,
  parentNpub: true,
  pendingParentRequests: true,
  localeDefaultsAppliedAt: true,
  primarySignerProfile: true,
  engagementLastCheckedAt: true,
} as const;

export type UserWithHashTagPresetsRow = {
  [K in keyof typeof USER_SCALAR_SELECT]: User[K];
} & {
  hashTagPresets: Array<{
    id: string;
    name: string;
    tags: string;
    description?: string | null;
  }>;
};

export function updateUserProfileByNpub(
  npub: string,
  nostrProfile: string
): Promise<User> {
  return prisma.user.update({
    where: { npub },
    data: { nostrProfile },
  });
}

export async function findUserByIdWithHashTagPresets(
  id: string
): Promise<UserWithHashTagPresetsRow | null> {
  return prisma.user.findUnique({
    where: { id },
    select: { ...USER_SCALAR_SELECT, hashTagPresets: true },
  });
}

export async function findUserByNpub(
  npub: string
): Promise<Partial<User> | null> {
  return await prisma.user.findUnique({
    where: { npub },
    select: USER_SCALAR_SELECT,
  });
}

export function upsertUserByNpub(
  npub: string,
  nostrProfile: string
): Promise<User> {
  return prisma.user.upsert({
    where: { npub },
    update: { nostrProfile },
    create: { npub, nostrProfile },
  });
}
