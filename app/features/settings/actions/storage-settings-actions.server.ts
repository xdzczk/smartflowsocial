/**
 * Storage settings action handlers
 */

import { json } from "@remix-run/node";

import { isSubscriptionActiveForGating } from "~/features/payments/subscriptions.server";
import {
  resolveUploadProviderWithTierDefaults,
  updateUserUploadProviderSettings,
  updateUserEnableMirrorBlossom,
  updateUserMirrorUploadUrls,
} from "~/features/user";
import { BRAND_BLOSSOM_LABEL } from "~/lib/brand";
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
    const isPaidActive = await isSubscriptionActiveForGating(userId);
    if (!isPaidActive && result.data.uploadProvider === "BLOSSOM_SFS") {
      return json(
        {
          success: false,
          error: `${BRAND_BLOSSOM_LABEL} requires an active paid subscription. Upgrade to select it.`,
        },
        { status: 403 }
      );
    }
    const resolvedProvider = resolveUploadProviderWithTierDefaults({
      persistedProvider: result.data.uploadProvider,
      isPaidActive,
    });
    await updateUserUploadProviderSettings(
      userId,
      resolvedProvider,
      result.data.customBlossomUrl
    );
    return json({
      success: true,
      uploadProvider: resolvedProvider,
      customBlossomUrl:
        resolvedProvider === "BLOSSOM_CUSTOM"
          ? result.data.customBlossomUrl
          : null,
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
