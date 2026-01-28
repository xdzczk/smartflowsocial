/**
 * Templates action handlers
 * Centralized action processing for templates page
 */

import { AssetType } from "@prisma/client";

import { getUserTimezone } from "~/features/user/services/user-settings.server";
import { formatForDateTimeLocal, nowInTimezone } from "~/lib/temporal";
import {
  templatesActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { createAsset, deleteAsset } from "~/models/asset.server";
import { deleteTemplate, getTemplates } from "~/models/template.server";
const ACTION_DELETE = "delete";
const ACTION_DELETE_ASSET = "delete_asset";
const ACTION_CREATE_TEXT_ASSET = "create_text_asset";
const ACTION_CREATE_MEDIA_ASSET = "create_media_asset";
const ACTION_BULK_CREATE_MEDIA_ASSETS = "bulk_create_media_assets";
const ACTION_BULK_DELETE_ASSETS = "bulk_delete_assets";

const ASSET_TYPE_VIDEO = "Video";
const ASSET_TYPE_IMAGE = "Image";

export async function handleTemplatesAction(
  formData: FormData,
  userId: string
) {
  const result = validateFormDataOrRespond(formData, templatesActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === ACTION_DELETE) {
    // TypeScript guarantees this is "delete" after the check
    const deleteData = result.data;
    await deleteTemplate({ id: deleteData.templateId, userId });
    return { success: true };
  }

  if (_action === ACTION_DELETE_ASSET) {
    // TypeScript guarantees this is "delete_asset" after the check
    const deleteData = result.data;
    await deleteAsset({ id: deleteData.assetId, userId });
    return { success: true };
  }

  if (_action === ACTION_CREATE_TEXT_ASSET) {
    // TypeScript guarantees this is "create_text_asset" after the check
    const textData = result.data;
    const asset = await createAsset({
      userId,
      title: textData.title,
      content: textData.content,
      tags: textData.tags,
      assetType: AssetType.TEXT,
    });

    return { success: true, asset };
  }

  if (
    _action === "create_image_asset" ||
    _action === "create_video_asset" ||
    _action === ACTION_CREATE_MEDIA_ASSET
  ) {
    // TypeScript guarantees this is one of the media asset actions after the check
    const mediaData = result.data;

    // These properties are validated by Zod, so they're safe to access
    const fileUrl = mediaData.uploadResult.file.url;
    const mimeType = mediaData.uploadResult.file.mimeType ?? "";

    // Determine asset type based on file URL extension or mime type
    let assetType: typeof AssetType.IMAGE | typeof AssetType.VIDEO =
      AssetType.IMAGE;
    const lower = fileUrl.toLowerCase();
    const videoExtensions = [
      ".mp4",
      ".webm",
      ".ogg",
      ".mov",
      ".avi",
      ".mkv",
      ".m4v",
    ];

    if (
      mimeType.startsWith("video/") ||
      videoExtensions.some((ext) => lower.includes(ext))
    ) {
      assetType = AssetType.VIDEO;
    }

    const asset = await createAsset({
      userId,
      title: mediaData.title,
      fileUrl,
      tags: mediaData.tags,
      assetType,
    });

    return { success: true, asset };
  }

  if (
    _action === "bulk_create_image_assets" ||
    _action === ACTION_BULK_CREATE_MEDIA_ASSETS
  ) {
    // TypeScript guarantees this is one of the bulk create actions after the check
    const bulkData = result.data;

    // Check for failed uploads
    const failedUploads = bulkData.uploadResults.filter(
      (result) => !result.success
    );
    if (failedUploads.length > 0) {
      return { error: "Some uploads failed" };
    }

    const assets = await Promise.all(
      bulkData.uploadResults.map(async (uploadResult, index: number) => {
        if (!uploadResult.file?.url) {
          throw new Error("File upload failed");
        }
        // These properties are validated by Zod, so they're safe to access
        const fileUrl = uploadResult.file.url;
        const mimeType = uploadResult.file.mimeType ?? "";

        // Determine asset type based on file URL extension or mime type
        let assetType: typeof AssetType.IMAGE | typeof AssetType.VIDEO =
          AssetType.IMAGE;
        const lower = fileUrl.toLowerCase();
        const videoExtensions = [
          ".mp4",
          ".webm",
          ".ogg",
          ".mov",
          ".avi",
          ".mkv",
          ".m4v",
        ];

        if (
          mimeType.startsWith("video/") ||
          videoExtensions.some((ext) => lower.includes(ext))
        ) {
          assetType = AssetType.VIDEO;
        }

        const titleValue = bulkData.titles[index];
        const assetTypeLabel =
          assetType === AssetType.VIDEO ? ASSET_TYPE_VIDEO : ASSET_TYPE_IMAGE;
        const title = titleValue ?? `${assetTypeLabel} ${String(index + 1)}`;
        const tagsString = bulkData.tags[index] ?? "";
        const tags = tagsString
          ? tagsString
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean)
          : [];

        return createAsset({
          userId,
          title,
          fileUrl,
          tags,
          assetType,
        });
      })
    );

    return { success: true, assets };
  }

  if (_action === ACTION_BULK_DELETE_ASSETS) {
    // TypeScript guarantees this is "bulk_delete_assets" after the check
    const bulkDeleteData = result.data;

    await Promise.all(
      bulkDeleteData.assetIds.map((assetId) =>
        deleteAsset({ id: assetId, userId })
      )
    );

    return { success: true, deletedCount: bulkDeleteData.assetIds.length };
  }

  // TypeScript guarantees this is "schedule" after all previous checks (discriminated union)
  // Use type assertion since discriminated union narrowing doesn't work here
  const scheduleData = result.data as {
    _action: "schedule";
    templateId: string;
  };
  const templates = await getTemplates({ userId });
  const template = templates.find((t) => t.id === scheduleData.templateId);

  if (!template) {
    return { error: "Template not found" };
  }

  // Prepare template data for scheduling
  // Get user's timezone for proper date handling
  const userTimezone = (await getUserTimezone(userId)) ?? "UTC";
  const now = nowInTimezone(userTimezone);
  const startTime = now.add({ hours: 1 });

  const templateData = template.posts.map((post, index) => {
    const scheduleDateTime = startTime.add({ hours: index });

    return {
      caption: post.caption ?? "",
      fileUrl: post.fileUrl,
      queueType: post.queueTypeId ?? "unassigned",
      scheduledFor: formatForDateTimeLocal(scheduleDateTime, userTimezone),
    };
  });

  return { scheduleData: templateData };
}
