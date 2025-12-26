/**
 * Storage settings action handlers
 */

import { json } from "@remix-run/node";
import {
  updateUserUploadProvider,
  updateUserEnableMirrorBlossom,
  updateUserMirrorUploadUrls,
} from "~/models/user.server";

export async function handleStorageSettingsAction(
  userId: string,
  action: string,
  formData: FormData,
) {
  if (action === "update_upload_provider") {
    const uploadProvider = formData.get("uploadProvider") as
      | "S3"
      | "BLOSSOM_PRIMAL"
      | "BLOSSOM_BLOSSTR";

    if (
      !uploadProvider ||
      !["S3", "BLOSSOM_PRIMAL", "BLOSSOM_BLOSSTR"].includes(uploadProvider)
    ) {
      return json({ error: "Invalid upload provider" }, { status: 400 });
    }

    await updateUserUploadProvider(userId, uploadProvider);
    return json({ success: true });
  }

  if (action === "update_blossom_mirrors") {
    const enableMirrorBlossom = formData.get("enableMirrorBlossom") === "on";
    const rawUrls = (formData.get("mirrorUrls") as string)
      .split("\n")
      .filter((url) => url.trim());

    // Clean and validate URLs
    const cleanedUrls: string[] = [];
    for (const url of rawUrls) {
      const trimmedUrl = url.trim();

      // Check if URL starts with https://
      if (!trimmedUrl.startsWith("https://")) {
        return json(
          { error: "All mirror URLs must start with https://" },
          { status: 400 },
        );
      }

      // Validate URL format
      try {
        new URL(trimmedUrl);
      } catch {
        return json(
          { error: "Invalid URL format in mirror URLs" },
          { status: 400 },
        );
      }

      // Clean URL by removing trailing slash
      const cleanedUrl = trimmedUrl.endsWith("/")
        ? trimmedUrl.slice(0, -1)
        : trimmedUrl;
      cleanedUrls.push(cleanedUrl);
    }

    await updateUserEnableMirrorBlossom(userId, enableMirrorBlossom);
    await updateUserMirrorUploadUrls(userId, cleanedUrls);
    return json({ success: true });
  }

  return null;
}




