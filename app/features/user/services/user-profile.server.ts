import type { User } from "../data/user-prisma-types.server";
import {
  findUserByIdWithHashTagPresets,
  findUserByNpub,
  updateUserProfileByNpub,
  upsertUserByNpub,
} from "../repositories/user-profile-data.server";

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
  return updateUserProfileByNpub(npub, nostrProfile);
}

/**
 * Gets a user by ID with hashtag presets included.
 * Selects columns explicitly so the query works when optional columns
 * (e.g. runwaySettings) are not yet migrated in the database.
 */
export async function getUserById(
  id: string
): Promise<UserWithHashTagPresets | null> {
  const user = await findUserByIdWithHashTagPresets(id);
  if (!user) return null;
  const result: UserWithHashTagPresets = {
    ...user,
    runwaySettings: null,
    primarySignerProfile: null,
  };
  return result;
}

/**
 * Gets a user by their Nostr public key (npub).
 * Uses explicit select so the query works when runwaySettings column is not yet migrated.
 */
export async function getUserByNpub(npub: string): Promise<User | null> {
  const user = await findUserByNpub(npub);
  if (!user) return null;
  const result = {
    ...user,
    runwaySettings: null,
    primarySignerProfile: null,
  };
  return result as User;
}

/**
 * Creates a new user or updates existing user's profile
 */
export function createUser(npub: string, nostrProfile: string): Promise<User> {
  return upsertUserByNpub(npub, nostrProfile);
}
