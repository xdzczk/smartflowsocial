/**
 * Zod validation schemas for post forms
 * These schemas are shared between client and server for consistent validation
 */

import { z } from "zod";

/**
 * Validation error messages
 */
const VALIDATION_MESSAGES = {
  POST_CONTENT_EMPTY: "Post content cannot be empty",
  CONTENT_REQUIRED: "Content is required",
  CONTENT_TOO_LONG: "Content too long",
  DEFAULT_QUEUE_TYPE: "unassigned",
  DEFAULT_QUEUE_TYPE_CAPITALIZED: "Unassigned",
} as const;

/**
 * Base post action schema
 */
export const postActionSchema = z.enum([
  "draft-text",
  "post-text",
  "schedule-text",
  "draft-image",
  "post-image",
  "schedule-image",
  "save-draft",
  "publish",
  "schedule-longform",
  "upload-image",
]);

/**
 * Text post schema
 */
export const textPostSchema = z.object({
  _action: postActionSchema,
  content: z
    .string()
    .min(1, VALIDATION_MESSAGES.POST_CONTENT_EMPTY)
    .max(5000, VALIDATION_MESSAGES.CONTENT_TOO_LONG),
  scheduledFor: z.string().nullable().optional(),
  queueType: z.string().default(VALIDATION_MESSAGES.DEFAULT_QUEUE_TYPE),
  queueTypeId: z.string().nullable().optional(),
  isRecyclable: z.boolean().default(false),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().nullable().optional(),
});

/**
 * Image post schema
 */
export const imagePostSchema = z.object({
  _action: postActionSchema,
  caption: z.string().max(5000, "Caption too long").optional(),
  scheduledFor: z.string().nullable().optional(),
  queueType: z.string().default(VALIDATION_MESSAGES.DEFAULT_QUEUE_TYPE),
  queueTypeId: z.string().nullable().optional(),
  isRecyclable: z.boolean().default(false),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().nullable().optional(),
});

/**
 * Longform post schema
 */
export const longformPostSchema = z.object({
  _action: postActionSchema,
  title: z
    .string()
    .min(1, "Title is required")
    .max(200, "Title too long")
    .optional(),
  content: z
    .string()
    .min(1, VALIDATION_MESSAGES.CONTENT_REQUIRED)
    .max(50000, VALIDATION_MESSAGES.CONTENT_TOO_LONG),
  scheduledFor: z.string().nullable().optional(),
  queueType: z
    .string()
    .default(VALIDATION_MESSAGES.DEFAULT_QUEUE_TYPE_CAPITALIZED),
  hashTagPresetId: z.string().nullable().optional(),
  useHashtagPresets: z.boolean().default(false),
});

/**
 * Bulk post schema
 */
export const bulkPostSchema = z.object({
  posts: z.array(
    z.object({
      content: z
        .string()
        .min(1, VALIDATION_MESSAGES.POST_CONTENT_EMPTY)
        .max(5000, VALIDATION_MESSAGES.CONTENT_TOO_LONG),
      scheduledFor: z.string().nullable().optional(),
      queueType: z.string().optional(),
      queueTypeId: z.string().nullable().optional(),
    })
  ),
});

/**
 * New post action schemas (for newpost-action.server.ts)
 * Note: File uploads are handled separately via parseMultipartFormData
 */
export const newPostBaseSchema = z.object({
  _action: z.string(),
  caption: z.string().optional().default(""),
  scheduledFor: z.string().nullable().default(null),
  queueType: z.string().optional().default("unassigned"),
  queueTypeId: z.string().nullable().default(null),
  isRecyclable: z.coerce.boolean().default(false).optional(),
  useHashtagPresets: z.coerce.boolean().default(false).optional(),
  hashTagPresetId: z.string().nullable().default(null),
  includeHashtagsInNoteBody: z.coerce.boolean().optional(),
});

/**
 * Upload preview actions (not validated, just pass through)
 */
export const uploadPreviewSchema = z.object({
  _action: z.enum(["upload-images-preview", "upload-media-preview"]),
});

/**
 * Draft text post schema
 */
export const draftTextPostSchema = newPostBaseSchema.extend({
  _action: z.literal("draft-text"),
  // Allow media-only drafts; composer submit path enforces constraints.
  content: z.string().default(""),
});

/**
 * Post or schedule text schema
 */
export const postOrScheduleTextSchema = newPostBaseSchema.extend({
  _action: z.enum(["post-text", "schedule-text"]),
  // Allow media-only text posts; submit logic validates text-or-media.
  content: z.string().default(""),
});

/**
 * Draft image post schema
 * Note: Handler accepts both "draft-image", "draft-images", and "draft-media"
 */
export const draftImagePostSchema = newPostBaseSchema.extend({
  _action: z.enum(["draft-image", "draft-images", "draft-media"]),
});

/**
 * Post or schedule image schema
 * Note: Handler accepts both singular and plural forms, and "media" variants
 */
export const postOrScheduleImageSchema = newPostBaseSchema.extend({
  _action: z.enum([
    "post-image",
    "post-images",
    "post-media",
    "schedule-image",
    "schedule-images",
    "schedule-media",
  ]),
});

/**
 * Union schema for new post actions
 * Note: upload-images-preview and upload-media-preview are handled separately
 * before validation as they don't need full validation
 */
export const newPostActionSchema = z.discriminatedUnion("_action", [
  draftTextPostSchema,
  postOrScheduleTextSchema,
  draftImagePostSchema,
  postOrScheduleImageSchema,
]);

/**
 * New longform post action schemas
 */
export const newLongformPostBaseSchema = z.object({
  _action: z.string(),
  queueType: z.string().optional().default("Unassigned"),
  useHashtagPresets: z.coerce.boolean().default(false).optional(),
  hashTagPresetId: z.string().nullable().optional(),
  includeHashtagsInNoteBody: z.coerce.boolean().optional(),
});

export const saveDraftLongformSchema = newLongformPostBaseSchema.extend({
  _action: z.literal("save-draft"),
  title: z.string().optional(),
  content: z.string().min(1, VALIDATION_MESSAGES.CONTENT_REQUIRED),
  longFormPostId: z.string().optional(),
});

export const autosaveDraftLongformSchema = newLongformPostBaseSchema.extend({
  _action: z.literal("autosave-draft"),
  title: z.string().optional(),
  content: z.string().min(1, VALIDATION_MESSAGES.CONTENT_REQUIRED),
});

export const publishLongformSchema = newLongformPostBaseSchema.extend({
  _action: z.literal("publish"),
  title: z.string().optional(),
  content: z.string().min(1, VALIDATION_MESSAGES.CONTENT_REQUIRED),
});

export const scheduleLongformSchema = newLongformPostBaseSchema.extend({
  _action: z.literal("schedule-longform"),
  title: z.string().optional(),
  content: z.string().min(1, VALIDATION_MESSAGES.CONTENT_REQUIRED),
  scheduledFor: z.string().min(1, "Scheduled time is required"),
});

export const uploadImageLongformSchema = z.object({
  _action: z.literal("upload-image"),
});

/**
 * Union schema for new longform post actions
 */
export const newLongformPostActionSchema = z.discriminatedUnion("_action", [
  saveDraftLongformSchema,
  autosaveDraftLongformSchema,
  publishLongformSchema,
  scheduleLongformSchema,
  uploadImageLongformSchema,
]);

/**
 * Bulk posts action schemas
 */
const signedEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  content: z.string(),
  tags: z.array(z.array(z.string())),
  sig: z.string(),
});

const nostrEventSchema = z.object({
  id: z.string().optional(),
  pubkey: z.string().optional(),
  created_at: z.number(),
  kind: z.number(),
  content: z.string(),
  tags: z.array(z.array(z.string())),
});

/**
 * Upload images preview schema
 */
export const uploadImagesPreviewSchema = z.object({
  uploadResults: z
    .string()
    .transform((val) => {
      try {
        const parsed = JSON.parse(val) as unknown;
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
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
                size: z.number().optional(),
                name: z.string().optional(),
                extension: z.string().optional(),
                sha256: z.string().optional(),
                mimeType: z.string().optional(),
                provider: z
                  .enum([
                    "S3",
                    "BLOSSOM_PRIMAL",
                    "BLOSSOM_BLOSSTR",
                    "BLOSSOM_SFS",
                    "BLOSSOM_CUSTOM",
                  ])
                  .optional(),
              })
              .optional(),
            error: z.string().optional(),
          })
        )
        .min(1, "At least one upload result is required")
    ),
  scheduledDates: z.array(z.string()),
  queueTypes: z.array(z.string()),
});

/**
 * Sign and schedule schema
 * Note: No per-request limit - only the 2000 posts/hour rate limit applies
 */
export const signAndScheduleSchema = z.object({
  signedEvents: z
    .array(z.string())
    .transform((arr) =>
      arr.map((str) => {
        try {
          const parsed = JSON.parse(str) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as z.infer<typeof signedEventSchema>;
          }
          throw new Error("Invalid signed event format");
        } catch {
          throw new Error("Invalid signed event format");
        }
      })
    )
    .pipe(z.array(signedEventSchema).min(1, "At least one post is required")),
  nostrEvent: z
    .array(z.string())
    .transform((arr) =>
      arr.map((str) => {
        try {
          const parsed = JSON.parse(str) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as z.infer<typeof nostrEventSchema>;
          }
          throw new Error("Invalid nostr event format");
        } catch {
          throw new Error("Invalid nostr event format");
        }
      })
    )
    .pipe(z.array(nostrEventSchema).min(1)),
  caption: z.array(z.string()).transform((arr) =>
    arr.map((str) => {
      try {
        const parsed = JSON.parse(str) as unknown;
        if (typeof parsed === "string") {
          return parsed;
        }
        if (Array.isArray(parsed)) {
          return parsed.join(" ");
        }
        return String(parsed ?? "");
      } catch {
        return str;
      }
    })
  ),
  fileUrl: z.array(z.string()).transform((arr) =>
    arr.map((str) => {
      try {
        const parsed = JSON.parse(str) as unknown;
        // Per-post: single string or array of URLs
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (item): item is string => typeof item === "string"
          );
        }
        if (typeof parsed === "string" && parsed.trim() !== "") {
          return [parsed];
        }
        return [];
      } catch {
        if (typeof str === "string" && str.trim() !== "") {
          return [str];
        }
        return [];
      }
    })
  ),
  queueType: z.array(z.string()),
  isRecyclable: z
    .array(z.string())
    .transform((arr) =>
      arr.map((val) => val === "true" || String(val).toLowerCase() === "true")
    ),
  originalPostId: z.array(z.string()).optional().default([]),
  repostSchedules: z.array(z.string()).optional().default([]),
  quoteSchedules: z.array(z.string()).optional().default([]),
  // Per-post nominal slot time (unix sec) used when a random schedule window
  // jittered the actual publish time. Empty strings mean "no randomization".
  nominalScheduledFor: z.array(z.string()).optional().default([]),
});

/**
 * Save as draft schema
 */
export const saveAsDraftSchema = z.object({
  fileUrl: z
    .array(z.string())
    .transform((arr) =>
      arr.map((str) => {
        try {
          const parsed = JSON.parse(str) as unknown;
          if (Array.isArray(parsed)) {
            return parsed.filter(
              (item): item is string => typeof item === "string"
            );
          }
          if (typeof parsed === "string" && parsed.trim() !== "") {
            return [parsed];
          }
          return [];
        } catch {
          return typeof str === "string" && str.trim() !== "" ? [str] : [];
        }
      })
    )
    .pipe(z.array(z.array(z.string())).min(1, "At least one post is required")),
  caption: z.array(z.string()),
  queueType: z.array(z.string()),
  scheduledFor: z.array(z.string()),
  originalPostId: z.array(z.string()).optional().default([]),
});

/**
 * Union schema for bulk posts actions
 */
export const bulkPostsActionSchema = z.discriminatedUnion("_action", [
  z
    .object({
      _action: z.literal("_upload_images_preview"),
    })
    .merge(uploadImagesPreviewSchema),
  z
    .object({
      _action: z.literal("sign_and_schedule"),
    })
    .merge(signAndScheduleSchema),
  z
    .object({
      _action: z.literal("save_as_draft"),
    })
    .merge(saveAsDraftSchema),
]);
