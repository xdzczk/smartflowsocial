/**
 * New longform loader data preparation
 * Centralized data fetching for new longform post page
 */

import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import type { ComposerContext } from "~/features/posts/composer";
import { getLongFormPost } from "~/features/posts/server";
import { loadComposerRelayLists } from "~/features/relays/relay-resolution.server";
import {
  getTemplatePrefill,
  getTemplateListSummaries,
} from "~/features/templates/services/template-data.server";
import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserUploadProvider,
} from "~/features/user";

/**
 * Load new longform post page data. When templateId is in the URL, load that template for prefill.
 * When composerContext is edit_scheduled, load that scheduled longform row for the full composer.
 */
export async function loadNewLongFormData(
  userId: string,
  templateId: string | null = null,
  composerContext: ComposerContext = { mode: "create" }
) {
  await requireAnySubscription(userId);

  const [
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    user,
    uploadProvider,
    templateSummaries,
    composerRelays,
  ] = await Promise.all([
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
    getUserById(userId),
    getUserUploadProvider(userId),
    getTemplateListSummaries({ userId, templateType: "LONGFORM" }),
    loadComposerRelayLists(userId),
  ]);

  const defaultPreset = hashTagPresets.find((p) => p.name === "Default");
  const tags = defaultPreset?.tags ?? "";

  const base = {
    userId,
    tags,
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    relays: composerRelays.default,
    relaysApp: composerRelays.app,
    relaysNip65Profile: composerRelays.nip65Profile,
    publishRelaySource: composerRelays.accountPublishRelaySource,
    userTimezone: user?.timezone ?? "Etc/GMT",
    uploadProvider,
    templates: templateSummaries.map((template) => ({
      id: template.id,
      name: template.name,
    })),
  };

  if (composerContext.mode === "edit_scheduled") {
    const post = await getLongFormPost({
      id: composerContext.scheduledActionId,
      userId,
    });
    if (!post) {
      throw new Response("Scheduled article not found", { status: 404 });
    }
    if (post.currentState !== "SCHEDULED") {
      throw new Response(
        "Only scheduled articles can be opened with this link.",
        { status: 400 }
      );
    }
    const qt = post.queueType;
    return {
      ...base,
      initialTemplateData: {
        id: post.id,
        title: post.title ?? "",
        summary: post.summary ?? "",
        content: post.content ?? "",
        image: post.image ?? "",
        tags: Array.isArray(post.tags) ? post.tags : [],
        queueType: qt ? { name: qt.name } : undefined,
      },
    };
  }

  if (templateId && templateId.length > 0) {
    const prefill = await getTemplatePrefill({ id: templateId, userId });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- prefill type discriminated at runtime
    if (prefill?.type === "LONGFORM" && prefill.longform) {
      return {
        ...base,
        initialTemplateData: prefill.longform,
      };
    }
  }

  return { ...base, initialTemplateData: null };
}
