/**
 * Zod validation schemas for template action handlers
 */

import { z } from "zod";

/**
 * Delete template schema
 */
export const deleteTemplateSchema = z.object({
  _action: z.literal("delete"),
  templateId: z.string().min(1, "Template ID is required"),
});

/**
 * Delete asset schema
 */
export const deleteAssetSchema = z.object({
  _action: z.literal("delete_asset"),
  assetId: z.string().min(1, "Asset ID is required"),
});

/**
 * Create text asset schema
 */
export const createTextAssetSchema = z.object({
  _action: z.literal("create_text_asset"),
  title: z.string().min(1, "Title is required"),
  content: z.string(),
  tags: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(z.string())),
});

/**
 * Upload result schema for media assets
 */
const uploadResultSchema = z
  .string()
  .transform((val) => {
    try {
      const parsed = JSON.parse(val) as unknown;
      if (
        !parsed ||
        typeof parsed !== "object" ||
        Array.isArray(parsed)
      ) {
        throw new Error("Invalid upload result");
      }
      const parsedObj = parsed as Record<string, unknown>;
      if (
        typeof parsedObj.success !== "boolean" ||
        !parsedObj.file ||
        typeof parsedObj.file !== "object" ||
        Array.isArray(parsedObj.file) ||
        typeof (parsedObj.file as Record<string, unknown>).url !== "string"
      ) {
        throw new Error("Invalid upload result");
      }
      return {
        success: parsedObj.success,
        file: {
          url: (parsedObj.file as Record<string, unknown>).url as string,
          mimeType:
            typeof (parsedObj.file as Record<string, unknown>).mimeType === "string"
              ? ((parsedObj.file as Record<string, unknown>).mimeType as string)
              : undefined,
        },
      };
    } catch {
      throw new Error("Invalid upload result format");
    }
  })
  .pipe(
    z.object({
      success: z.boolean(),
      file: z.object({
        url: z.string().url(),
        mimeType: z.union([z.string(), z.undefined()]),
      }),
    }),
  );

/**
 * Create media asset schema (image, video, or generic media)
 */
export const createMediaAssetSchema = z.object({
  _action: z.enum([
    "create_image_asset",
    "create_video_asset",
    "create_media_asset",
  ]),
  title: z.string().min(1, "Title is required"),
  uploadResult: uploadResultSchema,
  tags: z
    .string()
    .optional()
    .transform((val) =>
      val
        ? val
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(z.string())),
});

/**
 * Bulk create media assets schema
 */
const bulkUploadResultSchema = z
  .string()
  .transform((val) => {
    try {
      const parsed = JSON.parse(val) as unknown;
      if (!Array.isArray(parsed)) {
        throw new Error("Invalid upload results format");
      }
      return parsed as Array<{
        success?: boolean;
        file?: { url?: string; mimeType?: string };
        error?: string;
      }>;
    } catch {
      throw new Error("Invalid upload results format");
    }
  })
  .pipe(
    z
      .array(
        z.object({
          success: z.boolean().optional(),
          file: z
            .object({
              url: z.string().optional(),
              mimeType: z.string().optional(),
            })
            .optional(),
          error: z.string().optional(),
        }),
      )
      .min(1, "At least one upload result is required"),
  );

export const bulkCreateMediaAssetsSchema = z.object({
  _action: z.enum([
    "bulk_create_image_assets",
    "bulk_create_media_assets",
  ]),
  uploadResults: bulkUploadResultSchema,
  titles: z.array(z.string()),
  tags: z.array(z.string()),
});

/**
 * Bulk delete assets schema
 */
export const bulkDeleteAssetsSchema = z.object({
  _action: z.literal("bulk_delete_assets"),
  assetIds: z.array(z.string().min(1)).min(1, "At least one asset ID is required"),
});

/**
 * Schedule template schema
 */
export const scheduleTemplateSchema = z.object({
  _action: z.literal("schedule"),
  templateId: z.string().min(1, "Template ID is required"),
});

/**
 * Union schema for all template actions
 */
export const templatesActionSchema = z.discriminatedUnion("_action", [
  deleteTemplateSchema,
  deleteAssetSchema,
  createTextAssetSchema,
  createMediaAssetSchema,
  bulkCreateMediaAssetsSchema,
  bulkDeleteAssetsSchema,
  scheduleTemplateSchema,
]);

/**
 * Template edit action schemas
 */
export const updateTemplateNameSchema = z.object({
  _action: z.literal("updateName"),
  name: z.string().min(1, "Template name is required"),
});

export const removePostFromTemplateSchema = z.object({
  _action: z.literal("removePost"),
  postId: z.string().min(1, "Post ID is required"),
});

export const deleteTemplateEditSchema = z.object({
  _action: z.literal("delete"),
});

export const deleteTemplateRedirectSchema = z.object({
  _action: z.literal("deleteTemplate"),
});

export const scheduleTemplateEditSchema = z.object({
  _action: z.literal("schedule"),
});

/**
 * Union schema for template edit actions
 */
export const templateEditActionSchema = z.discriminatedUnion("_action", [
  updateTemplateNameSchema,
  removePostFromTemplateSchema,
  deleteTemplateEditSchema,
  deleteTemplateRedirectSchema,
  scheduleTemplateEditSchema,
]);

