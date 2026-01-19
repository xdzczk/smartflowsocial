/**
 * New post action handlers
 * Centralized action processing for new post page
 */

import {
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { createUploadHandler } from "~/features/upload/s3.server";
import { getUserById } from "~/features/user";
import { extractCorrelationId } from "~/lib/correlation-context.server";
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
  const { userRelays, showHashTagsinPosts } = user;
  const sessionPubkey = user.npub;
  const sanitizedRelays = userRelays.map((relay: string) => relay.trim());

  // Check content type before parsing
  const contentType = request.headers.get("Content-Type") ?? "";

  let formData: FormData;
  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = composeUploadHandlers(
      createUploadHandler(userId),
      createMemoryUploadHandler()
    );
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  // Check for upload preview actions first (they don't need full validation)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";

  if (
    _action === "upload-images-preview" ||
    _action === "upload-media-preview"
  ) {
    const result = handleUploadPreview(formData);
    if (!result.success) {
      return Response.json(
        { error: result.error ?? "Upload preview failed" },
        { status: 400 }
      );
    }
    return Response.json(result);
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

  // Common handler parameters
  const handlerParams = {
    userId,
    sessionPubkey,
    formData,
    hashTagPresetTags,
    showHashTagsinPosts,
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

  return Response.json({ success: false });
}
