/**
 * Upload provider service layer
 * Handles user upload provider settings
 */

import { DatabaseError } from "~/lib/errors";
import {
  getUserUploadProvider,
  getUserEnableMirrorBlossom,
  getUserMirrorUploadUrls,
} from "~/models/user.server";

/**
 * Load user upload provider settings
 */
export async function loadUploadProviderSettings(userId: string) {
  let provider, enableMirrorBlossom, mirrorUploadUrls;
  
  try {
    [provider, enableMirrorBlossom, mirrorUploadUrls] = await Promise.all([
      getUserUploadProvider(userId),
      getUserEnableMirrorBlossom(userId),
      getUserMirrorUploadUrls(userId),
    ]);
  } catch (error) {
    throw new DatabaseError("Failed to get upload provider settings", {
      userId,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }

  return {
    provider,
    enableMirrorBlossom,
    mirrorUploadUrls,
  };
}













