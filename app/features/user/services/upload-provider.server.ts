/**
 * Upload provider service layer
 * Handles user upload provider settings
 */

import {
  getResolvedUploadProviderSettings,
  getUserEnableMirrorBlossom,
  getUserMirrorUploadUrls,
} from "~/features/user";
import { DatabaseError } from "~/lib/errors";

/**
 * Load user upload provider settings
 */
export async function loadUploadProviderSettings(userId: string) {
  try {
    const [providerSettings, enableMirrorBlossom, mirrorUploadUrls] =
      await Promise.all([
        getResolvedUploadProviderSettings(userId),
        getUserEnableMirrorBlossom(userId),
        getUserMirrorUploadUrls(userId),
      ]);
    const { provider, customBlossomUrl } = providerSettings;

    return {
      provider,
      customBlossomUrl,
      enableMirrorBlossom,
      mirrorUploadUrls,
    };
  } catch (error) {
    throw new DatabaseError("Failed to get upload provider settings", {
      userId,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
