/**
 * Templates action handlers
 * Centralized action processing for templates page
 */

import { AssetType } from "@prisma/client";

import {
  createAsset,
  deleteAsset,
} from "~/models/asset.server";
import { deleteTemplate, getTemplates } from "~/models/template.server";

export async function handleTemplatesAction(
  formData: FormData,
  userId: string,
) {
  const _action = formData.get("_action");

  if (_action === "delete") {
    const templateId = formData.get("templateId");
    await deleteTemplate({ id: templateId as string, userId });
    return { success: true };
  }

  if (_action === "delete_asset") {
    const assetId = formData.get("assetId");
    await deleteAsset({ id: assetId as string, userId });
    return { success: true };
  }

  if (_action === "create_text_asset") {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const tagsString = formData.get("tags") as string;
    const tags = tagsString
      ? tagsString
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    const asset = await createAsset({
      userId,
      title,
      content,
      tags,
      assetType: AssetType.TEXT,
    });

    return { success: true, asset };
  }

  if (
    _action === "create_image_asset" ||
    _action === "create_video_asset" ||
    _action === "create_media_asset"
  ) {
    const title = formData.get("title") as string;
    const uploadResultRaw = formData.get("uploadResult");
    const uploadResultParsed: unknown = typeof uploadResultRaw === "string" ? JSON.parse(uploadResultRaw) : null;
    
    if (!uploadResultParsed || typeof uploadResultParsed !== "object" || Array.isArray(uploadResultParsed)) {
      return { error: "Invalid upload result format" };
    }
    
    const uploadResult = uploadResultParsed as unknown as { success?: unknown; file?: { url?: string; mimeType?: string } };
    
    const tagsString = formData.get("tags") as string;
    const tags = tagsString
      ? tagsString
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : [];

    if (!uploadResult.success || !uploadResult.file?.url) {
      return { error: "No file uploaded or upload failed" };
    }

    const fileUrl = uploadResult.file.url;
    if (typeof fileUrl !== "string") {
      return { error: "Invalid file URL" };
    }

    // Determine asset type based on file URL extension or mime type
    let assetType: typeof AssetType.IMAGE | typeof AssetType.VIDEO = AssetType.IMAGE;
    const mimeType = typeof uploadResult.file.mimeType === "string" ? uploadResult.file.mimeType : "";
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
      title,
      fileUrl,
      tags,
      assetType,
    });

    return { success: true, asset };
  }

  if (
    _action === "bulk_create_image_assets" ||
    _action === "bulk_create_media_assets"
  ) {
    const uploadResultsRaw = formData.get("uploadResults");
    const uploadResultsParsed: unknown = typeof uploadResultsRaw === "string" ? JSON.parse(uploadResultsRaw) : null;
    
    if (!Array.isArray(uploadResultsParsed)) {
      return { error: "Invalid upload results format" };
    }
    
    const uploadResults = uploadResultsParsed as unknown as { success?: unknown; file?: { url?: string; mimeType?: string } | undefined; error?: string }[];
    const titles = formData.getAll("titles") as string[];
    const tagsInputs = formData.getAll("tags") as string[];

    if (uploadResults.length === 0) {
      return { error: "No files uploaded" };
    }

    // Check for failed uploads
    const failedUploads = uploadResults.filter(
      (result) => !result.success,
    );
    if (failedUploads.length > 0) {
      return { error: "Some uploads failed" };
    }

    const assets = await Promise.all(
      uploadResults.map(async (uploadResult, index: number) => {
        if (!uploadResult.file?.url) {
          throw new Error("File upload failed");
        }
        const fileUrl = uploadResult.file.url;
        if (typeof fileUrl !== "string") {
          throw new Error("Invalid file URL");
        }
        const mimeType = typeof uploadResult.file.mimeType === "string" ? uploadResult.file.mimeType : "";

        // Determine asset type based on file URL extension or mime type
        let assetType: typeof AssetType.IMAGE | typeof AssetType.VIDEO = AssetType.IMAGE;
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
          titles[index] ||
          `${assetType === AssetType.VIDEO ? "Video" : "Image"} ${index + 1}`;
        const tagsString = tagsInputs[index] || "";
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
      }),
    );

    return { success: true, assets };
  }

  if (_action === "bulk_delete_assets") {
    const assetIds = formData.getAll("assetIds") as string[];

    if (assetIds.length === 0) {
      return { error: "No assets selected for deletion" };
    }

    await Promise.all(
      assetIds.map((assetId) => deleteAsset({ id: assetId, userId })),
    );

    return { success: true, deletedCount: assetIds.length };
  }

  if (_action === "schedule") {
    const templateId = formData.get("templateId");
    const templates = await getTemplates({ userId });
    const template = templates.find((t) => t.id === templateId);

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
        caption: post.caption || "",
        fileUrl: post.fileUrl,
        queueType: post.queueTypeId || "unassigned",
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

