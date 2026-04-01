import type { User } from "~/features/user/data/user-prisma-types.server";
import {
  updateUserTimezoneRow,
  findUserTimezoneRow,
  updateUserRelaysRow,
  updateUserRelayPublishingPreferencesRow,
  findUserRelaysRow,
  updateGiveawayBlacklistRow,
  findGiveawayBlacklistRow,
  updateScheduleIntervalRow,
  findScheduleIntervalRow,
} from "~/features/user/repositories/user-settings-data.server";

/**
 * Updates user's timezone
 */
export function updateUserTimezone(
  userId: string,
  timezone: string
): Promise<User> {
  return updateUserTimezoneRow(userId, timezone);
}

/**
 * Gets user's timezone
 */
export async function getUserTimezone(userId: string): Promise<string | null> {
  const user = await findUserTimezoneRow(userId);
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
  return updateUserRelaysRow(userId, relays);
}

export type PublishRelaySource = "app" | "nip65_profile";

/**
 * Persists the app relay list and which source is active for publishing.
 */
export function updateUserRelayPublishingPreferences(
  userId: string,
  input: { relays: string[]; publishRelaySource: PublishRelaySource }
): Promise<User> {
  return updateUserRelayPublishingPreferencesRow(userId, {
    userRelays: input.relays,
    publishRelaySource: input.publishRelaySource,
  });
}

/**
 * Gets user's persisted relay intent (write relays only).
 *
 * Managed relays (e.g. Blastr) are NOT injected here; callers that need publish
 * relays must use the canonical resolver in `app/features/relays/relay-resolution.server.ts`.
 */
export async function getUserRelays(userId: string): Promise<string[]> {
  const user = await findUserRelaysRow(userId);
  return user?.userRelays ?? [];
}

/**
 * Updates user's giveaway blacklist
 */
export function updateGiveawayBlacklist(
  userId: string,
  blacklistedItems: string[]
): Promise<User> {
  return updateGiveawayBlacklistRow(userId, blacklistedItems);
}

/**
 * Gets user's giveaway blacklist
 */
export async function getGiveawayBlacklist(userId: string): Promise<string[]> {
  const user = await findGiveawayBlacklistRow(userId);
  return user?.giveawayBlackListed ?? [];
}

/**
 * Updates user's schedule intervals
 */
export function updateScheduleInterval(
  userId: string,
  intervals: string[]
): Promise<User> {
  return updateScheduleIntervalRow(userId, intervals);
}

/**
 * Gets user's schedule intervals
 */
export async function getScheduleInterval(userId: string): Promise<string[]> {
  const user = await findScheduleIntervalRow(userId);
  return user?.scheduleInterval ?? [];
}
