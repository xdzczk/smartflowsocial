/**
 * New post loader data preparation
 * Centralized data fetching for new post page
 */

import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import {
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { getAssets } from "~/models/asset.server";

import { loadDraftEditData } from "./draft-edit-loader.server";

/**
 * Load new post page data. When draftId is in the URL, also load that draft for composer prefill.
 */
export async function loadNewPostData(
  userId: string,
  draftId: string | null = null
) {
  await requireAnySubscription(userId);

  const [scheduleIntervals, queueTypes, hashTagPresets, assetsData, relays] =
    await Promise.all([
      getScheduleInterval(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
      getAssets({ userId, page: 1, limit: 50 }),
      resolveExecutionRelays(userId),
    ]);

  const base = {
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    assets: assetsData.assets,
    relays,
  };

  if (!draftId || draftId.length === 0) {
    return { ...base, initialDraft: null, initialDraftId: null };
  }

  try {
    const draftData = await loadDraftEditData(userId, draftId);
    const post = draftData.post as {
      content?: string | null;
      caption?: string | null;
      fileUrl?: string[] | null;
      queueType?: { name: string } | null;
      queueTypeId?: string | null;
      tags?: string[] | null;
      draftMeta?: {
        attachmentMeta?: Array<{ localId: string; url: string; alt?: string }>;
      } | null;
      hashTagPresetId?: string | null;
    };
    const initialDraft = {
      content: post.content ?? "",
      caption: post.caption ?? "",
      fileUrl: post.fileUrl ?? [],
      queueType: post.queueType?.name ?? "unassigned",
      queueTypeId: post.queueTypeId ?? null,
      tags: Array.isArray(post.tags) ? post.tags.join(" ") : "",
      draftMeta: post.draftMeta ?? null,
      hashTagPresetId: post.hashTagPresetId ?? null,
    };
    return {
      ...base,
      initialDraft,
      initialDraftId: draftId,
    };
  } catch {
    return { ...base, initialDraft: null, initialDraftId: null };
  }
}
