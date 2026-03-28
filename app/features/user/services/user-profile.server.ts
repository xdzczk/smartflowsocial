import type { User } from "../data/user-prisma-types.server";
import {
  findUserByIdWithHashTagPresets,
  findUserByNpub,
  updateUserProfileByNpub,
  upsertUserByNpub,
  type UserWithHashTagPresetsRow,
} from "../repositories/user-profile-data.server";

/** Shape returned by {@link findUserByIdWithHashTagPresets} (explicit select; not every Prisma `User` column). */
export type UserWithHashTagPresets = UserWithHashTagPresetsRow;

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
 * Uses an explicit Prisma select so the app stays compatible when some DB columns
 * exist in schema but are not yet migrated in every environment.
 */
export async function getUserById(
  id: string
): Promise<UserWithHashTagPresets | null> {
  return findUserByIdWithHashTagPresets(id);
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
