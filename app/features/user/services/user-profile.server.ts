import type { User } from "@prisma/client";

import { prisma } from "~/lib/prisma.server";
import { blastrRelay } from "~/lib/relays";

export type UserWithHashTagPresets = User & {
  hashTagPresets: { id: string; name: string; tags: string; description?: string | null }[];
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
 * Gets a user by ID with hashtag presets included
 * Also includes blastrRelay if user has Premium/Founder subscription
 */
export async function getUserById(
  id: string,
): Promise<UserWithHashTagPresets | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      hashTagPresets: true,
    },
  });

  if (!user) {
    return null;
  }

  // Check if user has Premium or Founder subscription
  const subscription = await prisma.subscription.findUnique({
    where: { userId: id },
    include: {
      Plan: true,
    },
  });

  // Include blastrRelay if user has Premium or Founder plan with ACTIVE status
  if (
    subscription?.status === "ACTIVE" &&
    subscription?.Plan?.name &&
    (subscription.Plan.name.toLowerCase() === "premium" ||
      subscription.Plan.name.toLowerCase() === "founder")
  ) {
    // Add blastrRelay if not already present
    if (!user.userRelays.includes(blastrRelay)) {
      return {
        ...user,
        userRelays: [...user.userRelays, blastrRelay],
      };
    }
  }

  return user;
}

/**
 * Gets a user by their Nostr public key (npub)
 */
export function getUserByNpub(npub: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { npub } });
}

/**
 * Creates a new user or updates existing user's profile
 */
export function createUser(
  npub: string,
  nostrProfile: string,
): Promise<User> {
  return prisma.user.upsert({
    where: { npub },
    update: { nostrProfile },
    create: {
      npub,
      nostrProfile,
    },
  });
}






