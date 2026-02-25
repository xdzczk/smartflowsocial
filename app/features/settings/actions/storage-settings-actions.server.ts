/**
 * Storage settings action handlers
 */

import { json } from "@remix-run/node";

import {
  updateUserUploadProvider,
  updateUserEnableMirrorBlossom,
  updateUserMirrorUploadUrls,
} from "~/features/user";
import {
  updateUploadProviderSchema,
  updateBlossomMirrorsSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";

export async function handleStorageSettingsAction(
  userId: string,
  action: string,
  formData: FormData
) {
  if (action === "update_upload_provider") {
    const result = validateFormDataOrRespond(
      formData,
      updateUploadProviderSchema
    );
    if (!result.success) {
      return result.response;
    }
    await updateUserUploadProvider(userId, result.data.uploadProvider);
    return json({
      success: true,
      uploadProvider: result.data.uploadProvider,
      invalidateUploadProviderCache: true,
    });
  }

  if (action === "update_blossom_mirrors") {
    const result = validateFormDataOrRespond(
      formData,
      updateBlossomMirrorsSchema
    );
    if (!result.success) {
      return result.response;
    }
    await updateUserEnableMirrorBlossom(
      userId,
      result.data.enableMirrorBlossom
    );
    await updateUserMirrorUploadUrls(userId, result.data.mirrorUrls);
    return json({
      success: true,
      invalidateUploadProviderCache: true,
    });
  }

  return null;
}
