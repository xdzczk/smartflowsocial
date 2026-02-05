import type { User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

export type UserWithHashTagPresets = User & {
  hashTagPresets: Array<{
    id: string;
    name: string;
    tags: string;
    description?: string | null;
  }>;
};

interface UpdateUserProfileParams {
  nostrProfile: string;
  npub: string;
}

/**
 * Updates a user's Nostr profile data
 */
export function updateUserProfile({
  nostrProfile,
  npub,
}: UpdateUserProfileParams): Promise<User> {
  return prisma.user.update({
    where: { npub },
    data: {
      nostrProfile: nostrProfile,
    },
  });
}

/**
 * Gets a user by ID with hashtag presets included.
 * Selects columns explicitly so the query works when optional columns
 * (e.g. runwaySettings) are not yet migrated in the database.
 */
export async function getUserById(
  id: string
): Promise<UserWithHashTagPresets | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { ...USER_SCALAR_SELECT, hashTagPresets: true },
  });

  if (!user) {
    return null;
  }

  const result: UserWithHashTagPresets = { ...user, runwaySettings: null };
  return result;
}

/** Scalar User fields to select when runwaySettings column may not exist yet. */
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
} as const;

/**
 * Gets a user by their Nostr public key (npub).
 * Uses explicit select so the query works when runwaySettings column is not yet migrated.
 */
export async function getUserByNpub(npub: string): Promise<User | null> {
  const user = await prisma.user.findUnique({
    where: { npub },
    select: USER_SCALAR_SELECT,
  });
  if (!user) return null;
  const result: User = { ...user, runwaySettings: null };
  return result;
}

/**
 * Creates a new user or updates existing user's profile
 */
export function createUser(npub: string, nostrProfile: string): Promise<User> {
  return prisma.user.upsert({
    where: { npub },
    update: { nostrProfile },
    create: {
      npub,
      nostrProfile,
    },
  });
}
