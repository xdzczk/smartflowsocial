/**
 * New post action handlers
 * Centralized action processing for new post page
 */
/* eslint-disable sonarjs/cognitive-complexity -- action router branches by _action */

import {
  json,
  redirect,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { ScheduleCapExceededError } from "~/features/payments/entitlements/schedule-cap-policy.server";
import {
  cascadeAttachedReschedule,
  resyncAttachedChildrenAfterParentMutation,
  SchedulePostUseCase,
} from "~/features/posts/scheduling/index.server";
import { getPostById, updatePost } from "~/features/posts/server";
import { PublishEventMismatchError } from "~/features/posts/server/publishing";
import { resolveExecutionRelaysFromFormDetailed } from "~/features/relays/relay-resolution.server";
import { getUserById } from "~/features/user";
import { extractCorrelationId } from "~/lib/correlation-context.server";
import { logInfo, logWarning } from "~/lib/error-logger.server";
import { fromUnixTimestamp } from "~/lib/temporal";
import {
  newPostActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import {
  handleDraftImages,
  handlePostImages,
  handleScheduleImages,
} from "./newpost-action/handlers/media-handlers.server";
import {
  handleDraftText,
  handlePostOrScheduleText,
} from "./newpost-action/handlers/text-handlers.server";
import { getHashtagPresetTags } from "./newpost-action/hashtag-preset-utils.server";
import {
  handlePostOrSchedulePoll,
  resolvePollHashtagContext,
} from "./newpost-action/poll-handlers.server";
import { handleUploadPreview } from "./newpost-action/upload-preview-handler.server";

async function handleComposerUpdateMutation(
  userId: string,
  formData: FormData,
  mode: "edit_scheduled" | "edit_follow_up"
): Promise<Response> {
  const targetId =
    mode === "edit_follow_up"
      ? String(formData.get("followUpActionId") ?? "")
      : String(formData.get("scheduledActionId") ?? "");
  if (!targetId) {
    return json({ error: "Missing edit target id" }, { status: 400 });
  }
  const post = await getPostById({ id: targetId, userId });
  if (!post) {
    return json({ error: "Scheduled item not found" }, { status: 404 });
  }
  const postMeta = post as {
    dependencyMode?: string | null;
    parentScheduledActionId?: string | null;
    draftMeta?: unknown;
    scheduledAtUtc?: Date | null;
  };
  if (mode === "edit_follow_up" && postMeta.dependencyMode !== "attached") {
    return json(
      { error: "This scheduled item is not an attached follow-up." },
      { status: 400 }
    );
  }
  if (mode === "edit_scheduled" && postMeta.dependencyMode === "attached") {
    return json(
      { error: "Use follow-up editing for attached follow-ups." },
      { status: 400 }
    );
  }

  const { parseAttachmentMeta } =
    await import("./newpost-action/handlers/text-handlers.server");
  const { prepareComposerTextAndFileUrls } =
    await import("./newpost-action/inline-tokens.server");

  const content = String(formData.get("content") ?? "");
  const isThreadUpdate = String(formData.get("segments") ?? "").trim() !== "";
  const attachmentDiffRaw = String(formData.get("attachmentDiff") ?? "").trim();
  if (!attachmentDiffRaw && !isThreadUpdate) {
    return json(
      { error: "Attachment diff is required when editing scheduled content." },
      { status: 400 }
    );
  }
  let attachmentDiff: {
    removed?: Array<{ localId?: string }>;
    retained?: Array<{ localId?: string }>;
    added?: Array<{ localId?: string }>;
  } = {};
  if (attachmentDiffRaw) {
    try {
      attachmentDiff = JSON.parse(attachmentDiffRaw) as {
        removed?: Array<{ localId?: string }>;
        retained?: Array<{ localId?: string }>;
        added?: Array<{ localId?: string }>;
      };
    } catch {
      return json(
        { error: "Attachment diff is invalid JSON." },
        { status: 400 }
      );
    }
  }
  const attachmentMeta = parseAttachmentMeta(formData);
  const existingAttachmentMeta = (() => {
    const candidate = postMeta.draftMeta as { attachmentMeta?: unknown } | null;
    const raw = candidate?.attachmentMeta;
    if (!Array.isArray(raw)) return [] as Array<{ localId: string }>;
    return raw.filter((entry): entry is { localId: string } =>
      Boolean(
        entry &&
        typeof entry === "object" &&
        "localId" in entry &&
        typeof (entry as { localId?: unknown }).localId === "string"
      )
    );
  })();
  const existingIds = new Set(
    existingAttachmentMeta.map((entry) => entry.localId)
  );
  const removedIds = new Set(
    (attachmentDiff.removed ?? [])
      .map((entry) => entry.localId)
      .filter((id): id is string => Boolean(id))
  );
  for (const removedId of removedIds) {
    if (!existingIds.has(removedId)) {
      return json(
        {
          error: "Attachment removal payload is inconsistent with saved media.",
        },
        { status: 400 }
      );
    }
  }
  const prepared = prepareComposerTextAndFileUrls(content, attachmentMeta);
  const scheduledForRaw = String(formData.get("scheduledFor") ?? "");
  const scheduledFor =
    scheduledForRaw.trim() !== "" ? parseInt(scheduledForRaw, 10) : null;
  if (scheduledForRaw.trim() !== "" && Number.isNaN(scheduledFor)) {
    return json({ error: "Invalid scheduled time." }, { status: 400 });
  }

  if (mode === "edit_follow_up") {
    const parentId = String(
      formData.get("parentActionId") ?? postMeta.parentScheduledActionId ?? ""
    );
    if (parentId) {
      const parent = await getPostById({ id: parentId, userId });
      const effectiveScheduledFor =
        scheduledFor ??
        (postMeta.scheduledAtUtc
          ? Math.floor(postMeta.scheduledAtUtc.getTime() / 1000)
          : null);
      if (parent?.scheduledAtUtc && effectiveScheduledFor != null) {
        const parentUnix = Math.floor(parent.scheduledAtUtc.getTime() / 1000);
        if (effectiveScheduledFor < parentUnix) {
          return json(
            { error: "Follow-up must be scheduled at or after its parent." },
            { status: 400 }
          );
        }
      }
    } else {
      return json(
        { error: "Follow-up parent relationship is missing." },
        { status: 400 }
      );
    }
  }

  const signedEventRaw = String(formData.get("signedEvent") ?? "");
  const nostrEventRaw = String(formData.get("nostrEvent") ?? "");
  const signedEvent =
    signedEventRaw.trim() !== ""
      ? (JSON.parse(signedEventRaw) as SignedEvent)
      : undefined;
  const nostrEvent =
    nostrEventRaw.trim() !== ""
      ? (JSON.parse(nostrEventRaw) as NostrEvent)
      : undefined;

  const updated = await updatePost({
    id: targetId,
    userId,
    data: {
      content: prepared.content,
      caption: prepared.content,
      fileUrl: prepared.fileUrl,
      queueTypeId:
        String(formData.get("queueTypeId") ?? "") || post.queueTypeId,
      scheduledAtUtc: scheduledFor ?? undefined,
      signedEvent,
      nostrEvent,
      hashTagPresetId: String(formData.get("hashTagPresetId") ?? "") || null,
    },
  });

  if (scheduledFor) {
    await cascadeAttachedReschedule({
      rootPostId: targetId,
      userId,
      parentScheduledAtUtc: new Date(scheduledFor * 1000),
    });
  }
  if (signedEvent && scheduledFor) {
    const schedulePostUseCase = new SchedulePostUseCase();
    await schedulePostUseCase.execute({
      postId: targetId,
      userId,
      scheduledAtUtc: fromUnixTimestamp(scheduledFor, "UTC"),
      signedEvent,
    });
    await resyncAttachedChildrenAfterParentMutation({
      parentPostId: targetId,
      userId,
      parentPredictedEventId: signedEvent.id,
    });
  }

  return redirect(`/dashboard/scheduled?scheduled=${updated.id}`);
}

async function handleUpdateScheduledAction(
  userId: string,
  formData: FormData
): Promise<Response> {
  return handleComposerUpdateMutation(userId, formData, "edit_scheduled");
}

async function handleUpdateFollowUpAction(
  userId: string,
  formData: FormData
): Promise<Response> {
  return handleComposerUpdateMutation(userId, formData, "edit_follow_up");
}

/**
 * Main action handler for new post page
 */
export async function handleNewPostAction(
  userId: string,
  request: Request
): Promise<Response> {
  try {
    return await handleNewPostActionImpl(userId, request);
  } catch (e) {
    if (e instanceof ScheduleCapExceededError) {
      return json({ error: e.message }, { status: 403 });
    }
    if (e instanceof PublishEventMismatchError) {
      return json(
        {
          error:
            "This post id is already published with a different signed event. Please try publishing again as a new post.",
          code: "PUBLISH_EVENT_MISMATCH",
          postId: e.postId,
        },
        { status: 409 }
      );
    }
    throw e;
  }
}

async function handleNewPostActionImpl(
  userId: string,
  request: Request
): Promise<Response> {
  // Extract correlation ID from request headers
  const correlationId = extractCorrelationId(request.headers);

  const user = await getUserById(userId);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  const sessionPubkey = user.npub;

  // Check content type before parsing
  const contentType = request.headers.get("Content-Type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let formData: FormData;
  if (isMultipart) {
    const uploadHandler = createMemoryUploadHandler();
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  // Centralized per-post relay resolution. Uses the canonical
  // resolveExecutionRelaysFromForm helper so fresh-click and resume-click
  // submissions always traverse the same code path; the {source, relays}
  // structured log lets us *prove* in production that the resumed path is
  // not silently using a smaller relay subset (the "3 relays" perception
  // bug from the user report).
  const relayResolution = await resolveExecutionRelaysFromFormDetailed(
    userId,
    formData
  );
  const sanitizedRelays = relayResolution.relays;

  // Check for upload preview actions first (they don't need full validation)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";

  logInfo("publish.relays.resolved", {
    userId,
    action: _action || "unknown",
    source: relayResolution.source,
    relayCount: sanitizedRelays.length,
    relays: sanitizedRelays,
  });

  const hasBinaryFile = Array.from(formData.values()).some(
    (value) => value instanceof File
  );
  if (isMultipart && hasBinaryFile) {
    logWarning("Multipart media upload on newpost route rejected", {
      userId,
      action: _action || "unknown",
      route: "/dashboard/compose",
    });
    return json(
      {
        success: false,
        error: "Upload media client-side via Blossom first, then submit URLs.",
      },
      { status: 410 }
    );
  }

  if (
    _action === "upload-images-preview" ||
    _action === "upload-media-preview"
  ) {
    const result = handleUploadPreview(formData);
    if (!result.success) {
      return json(
        { error: result.error ?? "Upload preview failed" },
        { status: 400 }
      );
    }
    return json(result);
  }

  if (_action === "save-draft") {
    const { handleSaveDraft } =
      await import("./newpost-action/autosave-draft.server");
    return handleSaveDraft(userId, formData);
  }
  if (_action === "update-draft") {
    const draftId = String(formData.get("draftId") ?? "").trim();
    if (!draftId) {
      return json({ error: "Missing draftId for update." }, { status: 400 });
    }
    const existingDraft = await getPostById({ id: draftId, userId });
    if (!existingDraft || existingDraft.currentState !== "DRAFT") {
      return json(
        { error: "Draft no longer exists or is not editable." },
        { status: 404 }
      );
    }
    const { handleSaveDraft } =
      await import("./newpost-action/autosave-draft.server");
    return handleSaveDraft(userId, formData);
  }
  if (_action === "update-scheduled") {
    return handleUpdateScheduledAction(userId, formData);
  }
  if (_action === "update-follow-up") {
    return handleUpdateFollowUpAction(userId, formData);
  }

  if (_action === "post-thread" || _action === "schedule-thread") {
    const { handleThreadAction } =
      await import("./newpost-action/thread-handlers.server");
    return handleThreadAction(userId, sessionPubkey, formData, sanitizedRelays);
  }

  if (_action === "post-poll" || _action === "schedule-poll") {
    const queueTypePoll = String(formData.get("queueType") ?? "unassigned");
    const queueTypeIdPollRaw = formData.get("queueTypeId");
    const queueTypeIdPoll =
      queueTypeIdPollRaw != null && String(queueTypeIdPollRaw).trim() !== ""
        ? String(queueTypeIdPollRaw)
        : null;
    const isRecyclablePoll = formData.get("isRecyclable") === "on";
    const useHashtagPresetsPoll = formData.get("useHashtagPresets") === "on";
    const manualHashTagPresetIdPoll = useHashtagPresetsPoll
      ? String(formData.get("hashTagPresetId") ?? "")
      : null;
    const { hashTagPresetId: hashTagPresetIdPoll } =
      await resolvePollHashtagContext(
        userId,
        useHashtagPresetsPoll,
        manualHashTagPresetIdPoll === "" ? null : manualHashTagPresetIdPoll,
        queueTypePoll,
        queueTypeIdPoll
      );
    return handlePostOrSchedulePoll({
      userId,
      sessionPubkey,
      formData,
      sanitizedRelays,
      action: _action,
      correlationId,
      queueType: queueTypePoll,
      queueTypeId: queueTypeIdPoll,
      isRecyclable: isRecyclablePoll,
      hashTagPresetId: hashTagPresetIdPoll,
    });
  }

  // Validate non-file fields with Zod for other actions
  // Note: File uploads are handled separately by parseMultipartFormData
  const result = validateFormDataOrRespond(formData, newPostActionSchema);
  if (!result.success) {
    return result.response;
  }

  const validatedData = result.data;
  const queueType = validatedData.queueType || "unassigned";
  const queueTypeId = validatedData.queueTypeId;
  const isRecyclable = validatedData.isRecyclable ?? false;
  const useHashtagPresets = validatedData.useHashtagPresets ?? false;
  const manualHashTagPresetId = useHashtagPresets
    ? validatedData.hashTagPresetId
    : null;

  // Get hashtag preset tags
  const hashtagResult = await getHashtagPresetTags(
    userId,
    useHashtagPresets,
    manualHashTagPresetId,
    queueType,
    queueTypeId
  );
  const hashTagPresetTags =
    typeof hashtagResult === "object" &&
    !Array.isArray(hashtagResult) &&
    "tags" in hashtagResult &&
    typeof hashtagResult.tags === "string"
      ? hashtagResult.tags
      : "";
  const hashTagPresetId =
    typeof hashtagResult === "object" &&
    !Array.isArray(hashtagResult) &&
    "presetId" in hashtagResult
      ? hashtagResult.presetId
      : manualHashTagPresetId;

  const showHashTagsinPostsEffective =
    validatedData.includeHashtagsInNoteBody !== false;

  // Common handler parameters
  const handlerParams = {
    userId,
    sessionPubkey,
    formData,
    hashTagPresetTags,
    showHashTagsinPosts: showHashTagsinPostsEffective,
    queueType,
    queueTypeId,
    isRecyclable,
    hashTagPresetId,
    correlationId,
  };

  // Handle different actions
  if (_action === "draft-text") {
    return handleDraftText(handlerParams);
  }

  if (_action === "post-text" || _action === "schedule-text") {
    return handlePostOrScheduleText({
      ...handlerParams,
      sanitizedRelays,
      action: _action,
    });
  }

  if (
    _action === "post-image" ||
    _action === "post-images" ||
    _action === "post-media"
  ) {
    return handlePostImages({
      ...handlerParams,
      sanitizedRelays,
    });
  }

  if (
    _action === "schedule-image" ||
    _action === "schedule-images" ||
    _action === "schedule-media"
  ) {
    return handleScheduleImages(handlerParams);
  }

  if (
    _action === "draft-image" ||
    _action === "draft-images" ||
    _action === "draft-media"
  ) {
    return handleDraftImages(handlerParams);
  }

  return json({ success: false });
}
/* eslint-enable sonarjs/cognitive-complexity */
