/**
 * Longform edit loader data preparation
 * Centralized data fetching for longform edit page
 */

import { getLongFormPost } from "~/features/posts/server";
import { getDraftVersions } from "~/features/posts/server/drafts";
import { loadComposerRelayLists } from "~/features/relays/relay-resolution.server";
import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";

/**
 * Load longform edit page data
 */
export async function loadLongFormEditData(userId: string, postId: string) {
  const [
    post,
    scheduleIntervals,
    queueTypes,
    user,
    hashtagPresets,
    composerRelays,
  ] = await Promise.all([
    getLongFormPost({ id: postId, userId }),
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserById(userId),
    getUserHashTagPresets(userId),
    loadComposerRelayLists(userId),
  ]);

  if (!post) {
    throw new Response("Post not found", { status: 404 });
  }

  const defaultPreset = hashtagPresets.find((p) => p.name === "Default");
  const tags = defaultPreset?.tags ?? "";

  const versions = await getDraftVersions(null, postId);

  return {
    post,
    userId,
    tags,
    scheduleIntervals,
    queueTypes,
    userTimezone: user?.timezone ?? "Etc/GMT",
    hashtagPresets,
    versions,
    relays: composerRelays.default,
    relaysApp: composerRelays.app,
    relaysNip65Profile: composerRelays.nip65Profile,
    publishRelaySource: composerRelays.accountPublishRelaySource,
  };
}
