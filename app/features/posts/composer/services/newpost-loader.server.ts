/**
 * New post loader data preparation
 * Centralized data fetching for new post page
 */

import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import { loadDraftEditData } from "~/features/posts/server/drafts";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import {
  getTemplatePrefill,
  getTemplates,
} from "~/features/templates/services/template-data.server";
import {
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";
import { featureFlags } from "~/lib/feature-flags.server";

/**
 * Load new post page data. When draftId or templateId is in the URL, load that for composer prefill.
 * templateId takes precedence over draftId when both are present.
 */
export async function loadNewPostData(
  userId: string,
  draftId: string | null = null,
  templateId: string | null = null
) {
  await requireAnySubscription(userId);

  const [scheduleIntervals, queueTypes, hashTagPresets, relays, templates] =
    await Promise.all([
      getScheduleInterval(userId),
      getQueueTypes(userId),
      getUserHashTagPresets(userId),
      resolveExecutionRelays(userId),
      getTemplates({ userId }),
    ]);

  const base = {
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    relays,
    nip88PollsEnabled: featureFlags.nip88PollsEnabled,
    templates: templates.filter(
      (t) => (t as { templateType?: string }).templateType === "POST"
    ),
  };

  if (templateId && templateId.length > 0) {
    const prefill = await getTemplatePrefill({ id: templateId, userId });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- prefill type discriminated at runtime
    if (prefill?.type === "POST" && prefill.post) {
      return {
        ...base,
        initialDraft: prefill.post,
        initialDraftId: null,
      };
    }
  }

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
