import type { ProfileData } from "~/features/nostr/types";

import type { User } from "../data/user-prisma-types.server";
import {
  countUsers as countUsersRow,
  findEnabledUsersWithSubscriptions,
  findUserBasicInfo as findUserBasicInfoRow,
  findUserByNpubSelectProfile,
  findUserIdByNpub,
  findUsersByNpubs,
  updateUserDisabled,
} from "../repositories/user-queries-data.server";

/**
 * Gets basic user info (npub, isChild, parentNpub) by userId
 */
export async function getUserBasicInfo(userId: string): Promise<{
  npub: string | null;
  isChild: boolean;
  parentNpub: string | null;
} | null> {
  return findUserBasicInfoRow(userId);
}

/**
 * Gets users by an array of npubs with their profile info
 */
export async function getUsersByNpubs(
  npubs: string[]
): Promise<Array<{ npub: string; nostrProfile: ProfileData | null }>> {
  if (!npubs.length) return [];
  const users = await findUsersByNpubs(npubs);
  return users.map((user) => ({
    npub: user.npub,
    nostrProfile: user.nostrProfile ? (user.nostrProfile as ProfileData) : null,
  }));
}

/**
 * Gets a user by npub with their profile info
 */
export async function getUserByNpubWithProfile(
  npub: string
): Promise<{ npub: string; nostrProfile: ProfileData | null } | null> {
  const user = await findUserByNpubSelectProfile(npub);
  if (!user) return null;
  return {
    npub: user.npub,
    nostrProfile:
      user.nostrProfile &&
      typeof user.nostrProfile === "object" &&
      !Array.isArray(user.nostrProfile)
        ? (user.nostrProfile as ProfileData)
        : null,
  };
}

/**
 * Gets user id by npub
 */
export async function getUserIdByNpub(npub: string): Promise<string | null> {
  return findUserIdByNpub(npub);
}

/**
 * Counts total users in the database (used for healthcheck)
 */
export function countUsers(): Promise<number> {
  return countUsersRow();
}

/**
 * Gets all enabled users with their subscriptions for cron job processing
 */
export async function getEnabledUsersWithSubscriptions() {
  return findEnabledUsersWithSubscriptions();
}

/**
 * Disables a user account
 */
export async function disableUserAccount(userId: string): Promise<User> {
  return updateUserDisabled(userId);
}
