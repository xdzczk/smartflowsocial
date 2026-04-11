/**
 * New post loader data preparation
 * Centralized data fetching for new post page
 */

import type { SignedEvent } from "~/features/nostr/types";
import { requireAnySubscription } from "~/features/payments/subscriptions.server";
import type { ComposerContext } from "~/features/posts/composer/services/compose-route-contract";
import { getPostById } from "~/features/posts/server";
import { loadDraftEditData } from "~/features/posts/server/drafts";
import { loadComposerRelayLists } from "~/features/relays/relay-resolution.server";
import {
  getTemplatePrefill,
  getTemplates,
} from "~/features/templates/services/template-data.server";
import {
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserById,
} from "~/features/user";
import { featureFlags } from "~/lib/feature-flags.server";
import { formatNpubShort } from "~/lib/nostr-conversion";
import { dateFormatToLocale, formatForDisplay, fromDate } from "~/lib/temporal";

import { buildInitialPollRestoreFromDraftPost } from "./build-initial-poll-restore.server";

/**
 * Load new post page data. When draftId or templateId is in the URL, load that for composer prefill.
 * templateId takes precedence over draftId when both are present.
 */
interface LoadNewPostDataOptions {
  draftId?: string | null;
  templateId?: string | null;
  composerContext?: ComposerContext;
}

function getAccountDisplayLabel(user: unknown): string {
  const fallback = "@current-account";
  if (!user || typeof user !== "object") return fallback;

  const userObj = user as {
    username?: unknown;
    name?: unknown;
    npub?: unknown;
    nostrProfile?: unknown;
  };

  let profileName: string | undefined;
  let profileDisplayName: string | undefined;

  try {
    const parsedProfile: unknown =
      typeof userObj.nostrProfile === "string"
        ? (JSON.parse(userObj.nostrProfile) as unknown)
        : userObj.nostrProfile;
    if (
      parsedProfile &&
      typeof parsedProfile === "object" &&
      !Array.isArray(parsedProfile)
    ) {
      const profileObj = parsedProfile as {
        name?: unknown;
        display_name?: unknown;
      };
      profileName =
        typeof profileObj.name === "string" && profileObj.name.trim().length > 0
          ? profileObj.name.trim()
          : undefined;
      profileDisplayName =
        typeof profileObj.display_name === "string" &&
        profileObj.display_name.trim().length > 0
          ? profileObj.display_name.trim()
          : undefined;
    }
  } catch {
    // Ignore invalid profile JSON and continue with safe fallbacks.
  }

  if (profileDisplayName) return profileDisplayName;
  if (profileName) return profileName;

  if (
    typeof userObj.username === "string" &&
    userObj.username.trim().length > 0
  )
    return userObj.username.trim();
  if (typeof userObj.name === "string" && userObj.name.trim().length > 0)
    return userObj.name.trim();

  if (typeof userObj.npub === "string" && userObj.npub.trim().length > 0) {
    return formatNpubShort(userObj.npub.trim());
  }

  return fallback;
}

function readDraftMetaAttachmentMeta(post: {
  draftMeta?: {
    attachmentMeta?: Array<{ localId: string; url: string; alt?: string }>;
  } | null;
  fileUrl?: string[] | null;
}) {
  const fromMeta = post.draftMeta?.attachmentMeta;
  if (Array.isArray(fromMeta) && fromMeta.length > 0) return fromMeta;
  const urls = Array.isArray(post.fileUrl) ? post.fileUrl : [];
  return urls.map((url, index) => ({
    localId: `existing-${index + 1}`,
    url,
  }));
}

function mapExistingPostToInitialDraft(post: {
  caption?: string | null;
  content?: string | null;
  fileUrl?: string[] | null;
  queueType?: { name: string } | null;
  queueTypeId?: string | null;
  tags?: string[] | null;
  draftMeta?: {
    attachmentMeta?: Array<{ localId: string; url: string; alt?: string }>;
  } | null;
  hashTagPresetId?: string | null;
}) {
  return {
    content: post.content ?? post.caption ?? "",
    caption: post.caption ?? post.content ?? "",
    fileUrl: post.fileUrl ?? [],
    queueType: post.queueType?.name ?? "unassigned",
    queueTypeId: post.queueTypeId ?? null,
    tags: Array.isArray(post.tags) ? post.tags.join(" ") : "",
    draftMeta: {
      attachmentMeta: readDraftMetaAttachmentMeta(post),
    },
    hashTagPresetId: post.hashTagPresetId ?? null,
  };
}

export async function loadNewPostData(
  userId: string,
  draftIdOrOptions: string | LoadNewPostDataOptions | null = null,
  templateIdLegacy: string | null = null
) {
  await requireAnySubscription(userId);

  const options =
    typeof draftIdOrOptions === "object" && draftIdOrOptions !== null
      ? draftIdOrOptions
      : {
          draftId:
            typeof draftIdOrOptions === "string" ? draftIdOrOptions : null,
          templateId: templateIdLegacy,
          composerContext: undefined,
        };
  const draftId = options.draftId ?? null;
  const templateId = options.templateId ?? null;
  const composerContext = options.composerContext ?? {
    mode: "create" as const,
  };
  const effectiveDraftId =
    composerContext.mode === "edit_draft" ? composerContext.draftId : draftId;

  const [
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    composerRelays,
    templates,
    user,
  ] = await Promise.all([
    getScheduleInterval(userId),
    getQueueTypes(userId),
    getUserHashTagPresets(userId),
    loadComposerRelayLists(userId),
    getTemplates({ userId }),
    getUserById(userId),
  ]);

  const timezone =
    typeof user?.timezone === "string" && user.timezone.trim().length > 0
      ? user.timezone.trim()
      : "UTC";
  const userTimeFormat: "12h" | "24h" =
    user?.timeFormat === "24h" ? "24h" : "12h";
  const userDateFormat =
    user?.dateFormat === "mmddyyyy" || user?.dateFormat === "yyyymmdd"
      ? user.dateFormat
      : "ddmmyyyy";
  const dateLocale = dateFormatToLocale(userDateFormat);
  const base = {
    scheduleIntervals,
    queueTypes,
    hashTagPresets,
    relays: composerRelays.default,
    relaysApp: composerRelays.app,
    relaysNip65Profile: composerRelays.nip65Profile,
    publishRelaySource: composerRelays.accountPublishRelaySource,
    nip88PollsEnabled: featureFlags.nip88PollsEnabled,
    templates: templates.filter(
      (t) => (t as { templateType?: string }).templateType === "POST"
    ),
    composerContext,
    hydrationStatus: "ready" as const,
    hydrationError: null as string | null,
    initialScheduledFor: null as string | null,
    editingMeta: null as {
      modeLabel: string;
      accountLabel: string;
      scheduledForLabel?: string;
      statusLabel?: string;
      queueLabel?: string;
      parentActionId?: string;
    } | null,
  };
  const accountLabel = getAccountDisplayLabel(user);

  if (templateId && templateId.length > 0) {
    const prefill = await getTemplatePrefill({ id: templateId, userId });
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- prefill type discriminated at runtime
    if (prefill?.type === "POST" && prefill.post) {
      return {
        ...base,
        initialDraft: prefill.post,
        initialDraftId: null,
        initialPollRestore: null,
      };
    }
  }

  if (
    composerContext.mode === "edit_scheduled" ||
    composerContext.mode === "edit_follow_up"
  ) {
    const sourceId =
      composerContext.mode === "edit_scheduled"
        ? composerContext.scheduledActionId
        : composerContext.followUpActionId;
    const sourcePost = await getPostById({ id: sourceId, userId });
    if (!sourcePost) {
      return {
        ...base,
        hydrationStatus: "error" as const,
        hydrationError:
          "The scheduled item no longer exists or is inaccessible.",
      };
    }
    if (sourcePost.currentState === "PUBLISHED") {
      return {
        ...base,
        hydrationStatus: "error" as const,
        hydrationError: "This post is already published and cannot be edited.",
      };
    }
    const sourcePostForComposer = sourcePost as unknown as {
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
      parentScheduledActionId?: string | null;
      currentState?: string | null;
      scheduledAtUtc?: Date | null;
    };
    const scheduledForLabel =
      sourcePostForComposer.scheduledAtUtc != null
        ? formatForDisplay(
            fromDate(sourcePostForComposer.scheduledAtUtc, "UTC"),
            timezone,
            {
              month: "2-digit",
              day: "2-digit",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            },
            userTimeFormat,
            dateLocale
          )
        : undefined;
    const modeLabel =
      composerContext.mode === "edit_follow_up"
        ? "Editing follow-up"
        : "Editing scheduled post";
    return {
      ...base,
      initialDraft: mapExistingPostToInitialDraft(sourcePostForComposer),
      initialDraftId: null,
      initialPollRestore: buildInitialPollRestoreFromDraftPost(
        sourcePostForComposer
      ),
      initialScheduledFor: scheduledForLabel ?? null,
      editingMeta: {
        modeLabel,
        accountLabel,
        scheduledForLabel: scheduledForLabel ?? undefined,
        statusLabel: sourcePostForComposer.currentState ?? "SCHEDULED",
        queueLabel: sourcePostForComposer.queueType?.name ?? undefined,
        parentActionId:
          composerContext.mode === "edit_follow_up"
            ? (sourcePostForComposer.parentScheduledActionId ??
              composerContext.parentActionId)
            : undefined,
      },
    };
  }

  if (!effectiveDraftId || effectiveDraftId.length === 0) {
    return {
      ...base,
      initialDraft: null,
      initialDraftId: null,
      initialPollRestore: null,
    };
  }

  try {
    const draftData = await loadDraftEditData(userId, effectiveDraftId);
    const post = draftData.post as {
      postType?: string | null;
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
      signedEvent?: SignedEvent | null;
    };
    const initialDraft = {
      ...mapExistingPostToInitialDraft(post),
    };
    const initialPollRestore = buildInitialPollRestoreFromDraftPost(post);
    return {
      ...base,
      initialDraft,
      initialDraftId: effectiveDraftId,
      initialPollRestore,
      editingMeta: {
        modeLabel: "Editing draft",
        accountLabel,
        statusLabel: "DRAFT",
      },
    };
  } catch {
    return {
      ...base,
      initialDraft: null,
      initialDraftId: null,
      initialPollRestore: null,
      hydrationStatus: "error" as const,
      hydrationError: "The draft no longer exists or is inaccessible.",
    };
  }
}
