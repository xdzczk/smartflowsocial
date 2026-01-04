/**
 * Hashtag preset action handlers
 */

import { json } from "@remix-run/node";

import {
  createHashtagPresetSchema,
  updateHashtagPresetSchema,
  deleteHashtagPresetSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import {
  createHashTagPreset,
  updateHashTagPreset,
  deleteHashTagPreset,
} from "~/features/user";

export async function handleHashtagPresetAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "create_hashtag_preset") {
    const result = validateFormDataOrRespond(
      formData,
      createHashtagPresetSchema,
    );
    if (!result.success) {
      return result.response;
    }
    await createHashTagPreset(
      userId,
      result.data.name,
      result.data.tags,
      result.data.description,
    );
    return json({ success: true });
  }

  if (action === "update_hashtag_preset") {
    const result = validateFormDataOrRespond(
      formData,
      updateHashtagPresetSchema,
    );
    if (!result.success) {
      return result.response;
    }
    await updateHashTagPreset(
      userId,
      result.data.id,
      result.data.name,
      result.data.tags,
      result.data.description,
    );
    return json({ success: true });
  }

  if (action === "delete_hashtag_preset") {
    const result = validateFormDataOrRespond(
      formData,
      deleteHashtagPresetSchema,
    );
    if (!result.success) {
      return result.response;
    }
    await deleteHashTagPreset(userId, result.data.id);
    return json({ success: true });
  }

  return null;
}

