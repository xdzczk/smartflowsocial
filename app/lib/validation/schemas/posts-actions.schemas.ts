/**
 * Zod validation schemas for post action handlers
 * These schemas validate FormData from post-related actions
 */

import { z } from "zod";

/**
 * Action type constants
 */
const ACTION_DELETE = "delete";
const ACTION_DELETE_LONGFORM = "deleteLongForm";
const ACTION_BULK_DELETE = "bulkDelete";

/**
 * Validation error messages
 */
const ERROR_POST_ID_REQUIRED = "Post ID is required";
const AT_LEAST_ONE_POST_ID_REQUIRED = "At least one post ID is required";
const ERROR_SCHEDULED_TIME_REQUIRED = "Scheduled time is required";
const ERROR_SIGNED_EVENT_REQUIRED = "Signed event is required";

/**
 * Base action schema - validates the _action field
 */
export const postActionSchema = z.enum([
  ACTION_DELETE,
  ACTION_DELETE_LONGFORM,
  ACTION_BULK_DELETE,
  "bulkDeleteLongForm",
  "bulkDeleteMixed",
  "bulkSignAndResume",
]);

/**
 * Delete post schema
 */
export const deletePostSchema = z.object({
  _action: z.literal(ACTION_DELETE),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
});

/**
 * Delete longform post schema
 */
export const deleteLongFormPostSchema = z.object({
  _action: z.literal(ACTION_DELETE_LONGFORM),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
});

/**
 * Bulk delete posts schema
 */
export const bulkDeletePostsSchema = z.object({
  _action: z.literal(ACTION_BULK_DELETE),
  postIds: z
    .string()
    .transform((val) => {
      try {
        const parsed = JSON.parse(val) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    })
    .pipe(z.array(z.string()).min(1, AT_LEAST_ONE_POST_ID_REQUIRED)),
});

/**
 * Bulk delete longform posts schema
 */
export const bulkDeleteLongFormPostsSchema = z.object({
  _action: z.literal("bulkDeleteLongForm"),
  postIds: z
    .string()
    .transform((val) => {
      try {
        const parsed = JSON.parse(val) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    })
    .pipe(z.array(z.string()).min(1, AT_LEAST_ONE_POST_ID_REQUIRED)),
});

/**
 * Bulk delete mixed content schema
 */
export const bulkDeleteMixedSchema = z.object({
  _action: z.literal("bulkDeleteMixed"),
  itemData: z
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
            id: z.string().min(1),
            type: z.enum(["post", "longform"]),
          })
        )
        .min(1, "At least one item is required")
    ),
});

/**
 * Bulk sign and resume schema
 * Note: This schema expects arrays from FormData.getAll()
 */
export const bulkSignAndResumeSchema = z.object({
  _action: z.literal("bulkSignAndResume"),
  postIds: z
    .array(z.string().min(1))
    .min(1, "At least one post ID is required"),
  contents: z.array(z.string()),
  captions: z.array(z.string()),
  queueTypes: z.array(z.string()),
  queueTypeIds: z.array(z.string()),
  scheduledFors: z.array(z.string()),
  signedEvents: z.array(z.string()).transform((arr) =>
    arr.map((str) => {
      try {
        return JSON.parse(str) as {
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
          content: string;
          tags: string[][];
          sig: string;
        };
      } catch {
        throw new Error("Invalid signed event format");
      }
    })
  ),
  nostrEvents: z.array(z.string()).transform((arr) =>
    arr.map((str) => {
      try {
        return JSON.parse(str) as {
          id: string;
          pubkey: string;
          created_at: number;
          kind: number;
          content: string;
          tags: string[][];
        };
      } catch {
        throw new Error("Invalid nostr event format");
      }
    })
  ),
});

/**
 * Calendar reschedule schema
 */
export const calendarRescheduleSchema = z.object({
  action: z.literal("reschedule"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
  newTime: z.string().min(1, "New time is required"),
  overrideQueue: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => val === "true" || val === true)
    .pipe(z.boolean()),
  signedEvent: z.string().optional().nullable(),
  nostrEvent: z.string().optional().nullable(),
});

/**
 * Calendar reschedule longform schema
 */
export const calendarRescheduleLongformSchema = z.object({
  action: z.literal("rescheduleLongform"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
  newTime: z.string().min(1, "New time is required"),
  signedEvent: z.string().optional().nullable(),
  nostrEvent: z.string().optional().nullable(),
});

/**
 * Update runway settings (which queues count, mode, KPI color thresholds)
 */
export const updateRunwaySettingsSchema = z.object({
  _action: z.literal("updateRunwaySettings"),
  queueNames: z.array(z.string()),
  mode: z.enum(["last-post", "first-queue-empty"]),
  /** Red when runway ≤ this (0–365). */
  redThresholdDays: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .optional()
    .default(3),
  /** Orange when runway ≤ this (0–365); should be ≥ redThresholdDays. */
  orangeThresholdDays: z.coerce
    .number()
    .int()
    .min(0)
    .max(365)
    .optional()
    .default(7),
});

/**
 * Union schema for all dashboard actions
 */
export const dashboardActionSchema = z.discriminatedUnion("_action", [
  deletePostSchema,
  deleteLongFormPostSchema,
  bulkDeletePostsSchema,
  bulkDeleteLongFormPostsSchema,
  updateRunwaySettingsSchema,
]);

/**
 * Schedule repost: create one scheduled repost post from an existing post
 */
export const scheduleRepostSchema = z.object({
  _action: z.literal("scheduleRepost"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
  scheduledFor: z.string().min(1, ERROR_SCHEDULED_TIME_REQUIRED),
  signedEvent: z.string().min(1, ERROR_SIGNED_EVENT_REQUIRED),
});

/**
 * Schedule quote: create one scheduled quote post from an existing post
 */
export const scheduleQuoteSchema = z.object({
  _action: z.literal("scheduleQuote"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
  scheduledFor: z.string().min(1, ERROR_SCHEDULED_TIME_REQUIRED),
  signedEvent: z.string().min(1, ERROR_SIGNED_EVENT_REQUIRED),
  quoteCaption: z.string().optional(),
});

/**
 * Move scheduled post back to drafts (short or longform)
 */
export const moveToDraftSchema = z.object({
  _action: z.literal("moveToDraft"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
  type: z.enum(["post", "longform"]),
});

/**
 * Union schema for all scheduled actions
 */
export const scheduledActionSchema = z.discriminatedUnion("_action", [
  deletePostSchema,
  deleteLongFormPostSchema,
  bulkDeletePostsSchema,
  bulkDeleteLongFormPostsSchema,
  bulkDeleteMixedSchema,
  scheduleRepostSchema,
  scheduleQuoteSchema,
  moveToDraftSchema,
]);

/**
 * Union schema for all drafts actions
 */
export const draftsActionSchema = z.discriminatedUnion("_action", [
  deletePostSchema,
  deleteLongFormPostSchema,
  bulkDeletePostsSchema,
  bulkDeleteLongFormPostsSchema,
  bulkDeleteMixedSchema,
  bulkSignAndResumeSchema,
]);

/**
 * Draft edit update schema
 */
export const draftEditUpdateSchema = z.object({
  _action: z.literal("update"),
  content: z.string(),
  caption: z.string(),
  queueType: z.string().optional().nullable(),
  queueTypeId: z.string().optional().nullable(),
  useHashtagPresets: z.coerce.boolean().default(false).optional(),
  hashTagPresetId: z.string().optional().nullable(),
});

/**
 * Draft edit resume schema
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

export const draftEditResumeSchema = z.object({
  _action: z.literal("resume"),
  content: z.string(),
  caption: z.string(),
  queueType: z.string().optional().nullable(),
  queueTypeId: z.string().optional().nullable(),
  scheduledFor: z.string().min(1, ERROR_SCHEDULED_TIME_REQUIRED),
  signedEvent: z
    .string()
    .min(1, "Signed event is required")
    .transform((str) => {
      try {
        return JSON.parse(str) as z.infer<typeof signedEventSchema>;
      } catch {
        throw new Error("Invalid signed event format");
      }
    })
    .pipe(signedEventSchema),
  nostrEvent: z
    .string()
    .min(1, "Nostr event is required")
    .transform((str) => {
      try {
        return JSON.parse(str) as z.infer<typeof nostrEventSchema>;
      } catch {
        throw new Error("Invalid nostr event format");
      }
    })
    .pipe(nostrEventSchema),
  useHashtagPresets: z.coerce.boolean().default(false).optional(),
  hashTagPresetId: z.string().optional().nullable(),
  alsoScheduleRepost: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  repostScheduledFor: z.string().optional(),
  repostSignedEvent: z.string().optional(),
  /** JSON array of { scheduledFor, signedEvent } for multiple reposts */
  repostSchedules: z.string().optional(),
  alsoScheduleQuote: z
    .string()
    .optional()
    .transform((v) => v === "on" || v === "true"),
  quoteScheduledFor: z.string().optional(),
  quoteSignedEvent: z.string().optional(),
  quoteCaption: z.string().optional(),
  /** JSON array of { scheduledFor, signedEvent, caption? } for multiple quotes */
  quoteSchedules: z.string().optional(),
});

/**
 * Union schema for draft edit actions
 */
export const draftEditActionSchema = z.discriminatedUnion("_action", [
  draftEditUpdateSchema,
  draftEditResumeSchema,
]);

/**
 * Bulk repost schema
 */
export const bulkRepostSchema = z.object({
  _action: z.literal("bulkRepost"),
  postIds: z
    .string()
    .transform((val) => {
      try {
        const parsed = JSON.parse(val) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    })
    .pipe(z.array(z.string()).min(1, AT_LEAST_ONE_POST_ID_REQUIRED)),
});

/**
 * Bulk scheduled repost schema
 */
export const bulkScheduledRepostSchema = z.object({
  _action: z.literal("bulkScheduledRepost"),
  postIds: z
    .string()
    .transform((val) => {
      try {
        const parsed = JSON.parse(val) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    })
    .pipe(z.array(z.string()).min(1, AT_LEAST_ONE_POST_ID_REQUIRED)),
});

/**
 * Bulk quote schema
 */
export const bulkQuoteSchema = z.object({
  _action: z.literal("bulkQuote"),
  postIds: z
    .string()
    .transform((val) => {
      try {
        const parsed = JSON.parse(val) as unknown;
        return Array.isArray(parsed)
          ? parsed.filter((id): id is string => typeof id === "string")
          : [];
      } catch {
        return [];
      }
    })
    .pipe(z.array(z.string()).min(1, AT_LEAST_ONE_POST_ID_REQUIRED)),
});

/**
 * Single repost schema
 */
export const repostSchema = z.object({
  _action: z.literal("repost"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
});

/**
 * Longform repost schema
 */
export const longformRepostSchema = z.object({
  _action: z.literal("longformRepost"),
  longformPostId: z.string().min(1, "Longform post ID is required"),
});

/**
 * Longform quote schema
 */
export const longformQuoteSchema = z.object({
  _action: z.literal("longformQuote"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
});

/**
 * Single quote schema
 */
export const quoteSchema = z.object({
  _action: z.literal("quote"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
});

/**
 * Union schema for all posted actions
 */
export const postedActionSchema = z.discriminatedUnion("_action", [
  deletePostSchema,
  deleteLongFormPostSchema,
  bulkDeletePostsSchema,
  bulkDeleteLongFormPostsSchema,
  bulkDeleteMixedSchema,
  bulkRepostSchema,
  bulkScheduledRepostSchema,
  bulkQuoteSchema,
  repostSchema,
  quoteSchema,
  longformRepostSchema,
  longformQuoteSchema,
]);

/**
 * Search action schema
 */
export const searchActionSchema = z.discriminatedUnion("_action", [
  z.object({
    _action: z.literal("searchEvent"),
    eventInput: z.string().min(1, "Event ID is required"),
  }),
]);

/**
 * Recyclable action schemas
 */

/**
 * Delete recyclable post schema
 */
export const deleteRecyclablePostSchema = z.object({
  _action: z.literal(ACTION_DELETE),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
});

/**
 * Recycle post schema - creates a new post from a recyclable post
 */
export const recyclePostSchema = z.object({
  _action: z.literal("recycle"),
  postId: z.string().min(1, ERROR_POST_ID_REQUIRED),
  scheduledFor: z.string().optional(), // Unix timestamp as string
  queueTypeId: z.string().optional().nullable(),
  queueType: z.string().optional(),
});

/**
 * Discriminated union for all recyclable post actions
 */
export const recyclableActionSchema = z.discriminatedUnion("_action", [
  deleteRecyclablePostSchema,
  bulkDeletePostsSchema,
  bulkRepostSchema,
  bulkScheduledRepostSchema,
  bulkQuoteSchema,
  repostSchema,
  quoteSchema,
  recyclePostSchema,
]);
