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
 * Gets a user by ID with hashtag presets included
 *
 * NOTE:
 * This returns persisted user data only. Managed relays (e.g. Blastr) are
 * resolved separately by the canonical relay resolver.
 */
export async function getUserById(
  id: string
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
