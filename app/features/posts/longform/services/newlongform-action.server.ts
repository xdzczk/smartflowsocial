/**
 * New longform action handlers
 * Centralized action processing for new longform post page
 */

import {
  json,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";

import { resolveExecutionRelaysFromForm } from "~/features/relays/relay-resolution.server";
import { getUserById } from "~/features/user";
import {
  newLongformPostActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

import { getHashtagPresetTags } from "./newlongform-action-form.server";
import {
  handleImageUpload,
  handlePublish,
  handleSaveDraft,
  handleScheduleLongform,
} from "./newlongform-action-handlers.server";

/**
 * Main action handler for new longform post page
 */
export async function handleNewLongFormAction(
  userId: string,
  request: Request
): Promise<Response> {
  const user = await getUserById(userId);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }
  const sessionPubkey = user.npub;

  const contentType = request.headers.get("Content-Type") ?? "";
  let formData: FormData;

  if (contentType.includes("multipart/form-data")) {
    const uploadHandler = createMemoryUploadHandler();
    formData = await parseMultipartFormData(request, uploadHandler);
  } else {
    formData = await request.formData();
  }

  const sanitizedRelays = await resolveExecutionRelaysFromForm(
    userId,
    formData
  );

  // Check for upload-image action first (handled separately)
  const _actionValue = formData.get("_action");
  const _action = _actionValue ? String(_actionValue) : "";

  if (_action === "upload-image") {
    return handleImageUpload(userId, formData);
  }

  // Validate non-file fields with Zod
  const result = validateFormDataOrRespond(
    formData,
    newLongformPostActionSchema
  );
  if (!result.success) {
    return result.response;
  }

  const validatedData = result.data;

  // Type narrowing: exclude upload-image action (already handled above)
  if (validatedData._action === "upload-image") {
    // This shouldn't happen as we handle it above, but TypeScript needs it
    return handleImageUpload(userId, formData);
  }

  const queueType = validatedData.queueType || "Unassigned";
  const useHashtagPresets = validatedData.useHashtagPresets ?? false;
  const manualHashTagPresetId: string | null = useHashtagPresets
    ? (validatedData.hashTagPresetId ?? null)
    : null;

  // Get hashtag preset tags
  const { tags: hashTagPresetTags, presetId: hashTagPresetId } =
    await getHashtagPresetTags(
      userId,
      useHashtagPresets,
      manualHashTagPresetId,
      queueType
    );

  // Ensure hashTagPresetId is string | null (not undefined)
  const finalHashTagPresetId: string | null = hashTagPresetId ?? null;

  const showHashTagsinPostsEffective =
    validatedData.includeHashtagsInNoteBody !== false;

  // Handle different actions
  if (_action === "save-draft") {
    return handleSaveDraft(userId, formData, queueType, finalHashTagPresetId);
  }

  if (_action === "publish") {
    return handlePublish(
      userId,
      formData,
      queueType,
      finalHashTagPresetId,
      hashTagPresetTags,
      showHashTagsinPostsEffective,
      sanitizedRelays,
      sessionPubkey
    );
  }

  if (_action === "schedule-longform") {
    return handleScheduleLongform(
      userId,
      formData,
      queueType,
      finalHashTagPresetId,
      hashTagPresetTags,
      showHashTagsinPostsEffective,
      sessionPubkey
    );
  }

  return json({ success: false });
}
