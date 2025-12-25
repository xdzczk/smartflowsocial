import type { User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";

/**
 * Gets basic user info (npub, isChild, parentNpub) by userId
 */
export async function getUserBasicInfo(
  userId: string,
): Promise<{ npub: string | null; isChild: boolean; parentNpub: string | null } | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { npub: true, isChild: true, parentNpub: true },
  });
  if (!user) return null;
  return {
    npub: user.npub,
    isChild: user.isChild,
    parentNpub: user.parentNpub,
  };
}

/**
 * Gets users by an array of npubs with their profile info
 */
import type { ProfileData } from "~/features/nostr/types";

export async function getUsersByNpubs(
  npubs: string[],
): Promise<Array<{ npub: string; nostrProfile: ProfileData | null }>> {
  if (!npubs.length) return [];
  return prisma.user.findMany({
    where: { npub: { in: npubs } },
    select: { npub: true, nostrProfile: true },
  });
}

/**
 * Gets a user by npub with their profile info
 */
export async function getUserByNpubWithProfile(
  npub: string,
): Promise<{ npub: string; nostrProfile: ProfileData | null } | null> {
  return prisma.user.findUnique({
    where: { npub },
    select: { npub: true, nostrProfile: true },
  });
}

/**
 * Gets user id by npub
 */
export async function getUserIdByNpub(npub: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { npub },
    select: { id: true },
  });
  return user?.id || null;
}

/**
 * Counts total users in the database (used for healthcheck)
 */
export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

/**
 * Gets all enabled users with their subscriptions for cron job processing
 */
export async function getEnabledUsersWithSubscriptions() {
  return await prisma.user.findMany({
    where: {
      isEnabled: true,
    },
    include: {
      Subscription: {
        include: {
          Plan: true,
        },
      },
    },
  });
}

/**
 * Disables a user account
 */
export async function disableUserAccount(userId: string): Promise<User> {
  return await prisma.user.update({
    where: { id: userId },
    data: { isEnabled: false },
  });
}

