/**
 * New post action handlers
 * Centralized action processing for new post page
 */
/* eslint-disable sonarjs/cognitive-complexity -- action router branches by _action */

import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { getUserById } from "~/features/user";
import { extractCorrelationId } from "~/lib/correlation-context.server";
import { logWarning } from "~/lib/error-logger.server";
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

/**
 * Main action handler for new post page
 */
export async function handleNewPostAction(
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

  // Optional per-post relay override (from composer relay selector)
  let sanitizedRelays: string[];
  const relayOverrideRaw = formData.get("relays");
  if (relayOverrideRaw && typeof relayOverrideRaw === "string") {
    try {
      const parsed = JSON.parse(relayOverrideRaw) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        const urls = parsed.filter((r): r is string => typeof r === "string");
        if (urls.length > 0) {
          sanitizedRelays = urls;
        } else {
          sanitizedRelays = await resolveExecutionRelays(userId);
        }
      } else {
        sanitizedRelays = await resolveExecutionRelays(userId);
      }
    } catch {
      sanitizedRelays = await resolveExecutionRelays(userId);
    }
  } else {
    sanitizedRelays = await resolveExecutionRelays(userId);
  }

  // Check for upload preview actions first (they don't need full validation)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";

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
