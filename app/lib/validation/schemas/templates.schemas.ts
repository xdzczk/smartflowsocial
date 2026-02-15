/**
 * Zod validation schemas for template action handlers
 */

import { z } from "zod";

const ACTION_CREATE_TEMPLATE = "createTemplate" as const;
const DEFAULT_QUEUE_TYPE = "unassigned";
const TEMPLATE_NAME_REQUIRED = "Template name is required";
const TEMPLATE_ID_REQUIRED = "Template ID is required";

/**
 * Delete template schema
 */
export const deleteTemplateSchema = z.object({
  _action: z.literal("delete"),
  templateId: z.string().min(1, TEMPLATE_ID_REQUIRED),
});

/**
 * Schedule template schema
 */
export const scheduleTemplateSchema = z.object({
  _action: z.literal("schedule"),
  templateId: z.string().min(1, TEMPLATE_ID_REQUIRED),
});

/**
 * Bulk delete templates schema (templateIds come from formData.getAll("templateIds"))
 */
export const bulkDeleteTemplatesSchema = z.object({
  _action: z.literal("bulkDelete"),
});

/**
 * Create template from scratch (single post) - payload for POST type
 */
export const createTemplateFromScratchPostSchema = z.object({
  _action: z.literal(ACTION_CREATE_TEMPLATE),
  templateName: z.string().min(1, TEMPLATE_NAME_REQUIRED),
  content: z.string().default(""),
  caption: z.string().optional(),
  fileUrl: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return [] as string[];
      try {
        const parsed = JSON.parse(s) as unknown;
        return Array.isArray(parsed)
          ? (parsed as string[]).filter(
              (u): u is string => typeof u === "string"
            )
          : [];
      } catch {
        return [] as string[];
      }
    }),
  queueType: z.string().default(DEFAULT_QUEUE_TYPE),
  queueTypeId: z.string().nullable().optional(),
  tags: z.string().optional(),
  useHashtagPresets: z.boolean().optional(),
  hashTagPresetId: z.string().nullable().optional(),
  attachmentMeta: z.string().optional(),
});

/**
 * Create template from scratch (longform) - payload for LONGFORM type
 */
export const createTemplateFromScratchLongformSchema = z.object({
  _action: z.literal(ACTION_CREATE_TEMPLATE),
  templateName: z.string().min(1, TEMPLATE_NAME_REQUIRED),
  title: z.string().default(""),
  summary: z.string().optional(),
  content: z.string().default(""),
  image: z.string().optional(),
  customTags: z.string().optional(),
  queueType: z.string().default(DEFAULT_QUEUE_TYPE),
  queueTypeId: z.string().nullable().optional(),
  useHashtagPresets: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "true" || v === true),
  hashTagPresetId: z.string().nullable().optional(),
});

/**
 * Union schema for all template actions
 */
export const templatesActionSchema = z.discriminatedUnion("_action", [
  deleteTemplateSchema,
  scheduleTemplateSchema,
  bulkDeleteTemplatesSchema,
]);

/**
 * Template edit action schemas
 */
export const updateTemplateNameSchema = z.object({
  _action: z.literal("updateName"),
  name: z.string().min(1, TEMPLATE_NAME_REQUIRED),
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
 * Update template content (post-type): same fields as create but updates existing post
 */
export const updateTemplatePostSchema = z.object({
  _action: z.literal("updateTemplatePost"),
  templateId: z.string().min(1, TEMPLATE_ID_REQUIRED),
  postId: z.string().min(1, "Post ID is required"),
  name: z.string().min(1, TEMPLATE_NAME_REQUIRED).optional(),
  content: z.string().default(""),
  caption: z.string().optional(),
  fileUrl: z
    .string()
    .optional()
    .transform((s) => {
      if (!s) return [] as string[];
      try {
        const parsed = JSON.parse(s) as unknown;
        return Array.isArray(parsed)
          ? (parsed as string[]).filter(
              (u): u is string => typeof u === "string"
            )
          : [];
      } catch {
        return [] as string[];
      }
    }),
  queueType: z.string().default(DEFAULT_QUEUE_TYPE),
  queueTypeId: z.string().nullable().optional(),
  tags: z.string().optional(),
  useHashtagPresets: z.boolean().optional(),
  hashTagPresetId: z.string().nullable().optional(),
  attachmentMeta: z.string().optional(),
});

/**
 * Update template content (longform-type): same fields as create but updates existing longform
 */
export const updateTemplateLongformSchema = z.object({
  _action: z.literal("updateTemplateLongform"),
  templateId: z.string().min(1, TEMPLATE_ID_REQUIRED),
  longFormPostId: z.string().min(1, "LongForm post ID is required"),
  name: z.string().min(1, TEMPLATE_NAME_REQUIRED).optional(),
  title: z.string().default(""),
  summary: z.string().optional(),
  content: z.string().default(""),
  image: z.string().optional(),
  customTags: z.string().optional(),
  queueType: z.string().default(DEFAULT_QUEUE_TYPE),
  queueTypeId: z.string().nullable().optional(),
  useHashtagPresets: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === "true" || v === true),
  hashTagPresetId: z.string().nullable().optional(),
});

/**
 * Union schema for template edit actions
 */
export const templateEditActionSchema = z.discriminatedUnion("_action", [
  updateTemplateNameSchema,
  deleteTemplateEditSchema,
  deleteTemplateRedirectSchema,
  scheduleTemplateEditSchema,
  updateTemplatePostSchema,
  updateTemplateLongformSchema,
]);
