/**
 * Templates action handlers
 * Centralized action processing for templates page
 */

import { AssetType } from "@prisma/client";

import {
  templatesActionSchema,
  validateFormDataOrRespond,
} from "~/lib/validation";
import { createAsset, deleteAsset } from "~/models/asset.server";
import { deleteTemplate, getTemplates } from "~/models/template.server";

export async function handleTemplatesAction(
  formData: FormData,
  userId: string
) {
  const result = validateFormDataOrRespond(formData, templatesActionSchema);
  if (!result.success) {
    return result.response;
  }

  const { _action } = result.data;

  if (_action === "delete") {
    const deleteData = result.data._action === "delete" ? result.data : null;
    if (!deleteData) {
      return { error: "Invalid action" };
    }
    await deleteTemplate({ id: deleteData.templateId, userId });
    return { success: true };
  }

  if (_action === "delete_asset") {
    const deleteData =
      result.data._action === "delete_asset" ? result.data : null;
    if (!deleteData) {
      return { error: "Invalid action" };
    }
    await deleteAsset({ id: deleteData.assetId, userId });
    return { success: true };
  }

  if (_action === "create_text_asset") {
    const textData =
      result.data._action === "create_text_asset" ? result.data : null;
    if (!textData) {
      return { error: "Invalid action" };
    }
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
    _action === "create_media_asset"
  ) {
    const mediaData =
      result.data._action === "create_image_asset" ||
      result.data._action === "create_video_asset" ||
      result.data._action === "create_media_asset"
        ? result.data
        : null;
    if (!mediaData) {
      return { error: "Invalid action" };
    }

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
    _action === "bulk_create_media_assets"
  ) {
    const bulkData =
      result.data._action === "bulk_create_image_assets" ||
      result.data._action === "bulk_create_media_assets"
        ? result.data
        : null;
    if (!bulkData) {
      return { error: "Invalid action" };
    }

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

        const title =
          bulkData.titles[index] ??
          `${assetType === AssetType.VIDEO ? "Video" : "Image"} ${index + 1}`;
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

  if (_action === "bulk_delete_assets") {
    const bulkDeleteData =
      result.data._action === "bulk_delete_assets" ? result.data : null;
    if (!bulkDeleteData) {
      return { error: "Invalid action" };
    }

    await Promise.all(
      bulkDeleteData.assetIds.map((assetId) =>
        deleteAsset({ id: assetId, userId })
      )
    );

    return { success: true, deletedCount: bulkDeleteData.assetIds.length };
  }

  if (_action === "schedule") {
    const scheduleData =
      result.data._action === "schedule" ? result.data : null;
    if (!scheduleData) {
      return { error: "Invalid action" };
    }
    const templates = await getTemplates({ userId });
    const template = templates.find((t) => t.id === scheduleData.templateId);

    if (!template) {
      return { error: "Template not found" };
    }

    // Prepare template data for scheduling
    const localDate = new Date();
    localDate.setHours(localDate.getHours() + 1);

    const templateData = template.posts.map((post, index) => {
      const scheduleDate = new Date(localDate);
      scheduleDate.setHours(scheduleDate.getHours() + index);

      return {
        caption: post.caption ?? "",
        fileUrl: post.fileUrl,
        queueType: post.queueTypeId ?? "unassigned",
        scheduledFor: scheduleDate
          .toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
      };
    });

    return { scheduleData: templateData };
  }

  return { error: "Invalid action" };
}
