/**
 * Zod schemas for Remix loader responses
 * These schemas validate data returned from loaders to ensure type safety
 */

import { z } from "zod";

/**
 * Schema for PostStats (from stats.server.ts)
 */
const postStatsSchema = z.object({
  likes: z.number().default(0),
  replies: z.number().default(0),
  mentions: z.number().default(0),
  reposts: z.number().default(0),
  zaps: z.number().default(0),
  satszapped: z.number().default(0),
});

/**
 * Schema for pagination object
 */
const paginationSchema = z.object({
  total: z.number(),
  pages: z.number(),
  currentPage: z.number(),
  limit: z.number(),
});

/**
 * Schema for QueueType
 */
const queueTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string().nullable().optional(),
  colorToken: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  scheduleType: z.enum(["INTERVAL", "FIXED_SLOTS", "WEEKLY_SLOTS"]).optional(),
  scheduleConfig: z
    .object({
      useGlobalInterval: z.boolean().optional(),
      intervalHours: z.number().optional(),
      slots: z.array(z.string()).optional(),
      weeklySlots: z
        .array(z.object({ dayOfWeek: z.number(), time: z.string() }))
        .optional(),
    })
    .optional(),
  isEnabled: z.boolean().optional(),
  userId: z.string().optional(),
});

/**
 * Schema for User (minimal fields needed for loader responses)
 */
export const userSchema = z.object({
  id: z.string(),
  npub: z.string(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  isEnabled: z.boolean(),
  timezone: z.string().nullable(),
  timeFormat: z.enum(["12h", "24h"]).nullable().optional(),
  dateFormat: z
    .enum(["ddmmyyyy", "mmddyyyy", "yyyymmdd"])
    .nullable()
    .optional(),
  userRelays: z.array(z.string()),
  giveawayBlackListed: z.array(z.string()),
  uploadProvider: z.enum([
    "S3",
    "BLOSSOM_PRIMAL",
    "BLOSSOM_BLOSSTR",
    "BLOSSOM_SFS",
  ]),
  scheduleInterval: z.array(z.union([z.string(), z.number()])),
  pendingParentRequests: z.array(z.string()),
  pendingChildRequests: z.array(z.string()).optional(),
  enableMirrorBlossom: z.boolean().optional(),
  mirrorUploadUrls: z.array(z.string()).optional(),
  nwcEnabled: z.boolean().optional(),
  filterMuted: z.boolean().optional(),
  hidePostsFromLowTrustUsers: z.boolean().optional(),
  isChild: z.boolean().optional(),
  parentNpub: z.string().nullable().optional(),
});

/**
 * Schema for SignedEvent (minimal validation)
 */
const signedEventSchema = z
  .object({
    id: z.string(),
    pubkey: z.string(),
    created_at: z.number(),
    kind: z.number(),
    tags: z.array(z.array(z.string())),
    content: z.string(),
    sig: z.string(),
  })
  .passthrough(); // Allow additional fields

/**
 * Schema for NostrEvent (minimal validation)
 */
const nostrEventSchema = z
  .object({
    id: z.string().optional(),
    pubkey: z.string().optional(),
    created_at: z.number(),
    kind: z.number(),
    tags: z.array(z.array(z.string())),
    content: z.string(),
  })
  .passthrough(); // Allow additional fields

/**
 * Schema for PostDTO
 */
const postDTOSchema = z
  .object({
    id: z.string(),
    nostrEventId: z.string().nullable().optional(),
    caption: z
      .string()
      .nullish()
      .transform((val) => val ?? null),
    fileUrl: z.array(z.string()),
    scheduledAtUtc: z.string().nullable(),
    publishedAt: z.string().nullable(),
    content: z
      .string()
      .nullish()
      .transform((val) => val ?? null),
    postType: z.enum(["IMAGE", "CAROUSEL", "TEXT", "VIDEO"]),
    repost: z.boolean(),
    isQuotedPost: z.boolean(),
    isRecyclable: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
    status: z.enum([
      "DRAFT",
      "ACTIVE",
      "SCHEDULED",
      "PAUSED",
      "POSTED",
      "FAILED",
    ]),
    currentState: z.string(),
    signedEvent: signedEventSchema.nullable().optional(),
    nostrEvent: nostrEventSchema.nullable().optional(),
    queueTypeId: z.string().nullable().optional(),
    tags: z.array(z.string()),
    manual_override: z.boolean(),
    userId: z.string(),
    templateId: z.string().nullable().optional(),
    hashTagPresetId: z.string().nullable().optional(),
    queueType: queueTypeSchema.nullable().optional(),
    hashTagPreset: z
      .object({
        id: z.string(),
        name: z.string(),
        tags: z.string(),
        description: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    hashtags: z.string().optional(),
  })
  .passthrough(); // Allow additional fields

/**
 * Schema for LongFormPostDTO
 */
const longFormPostDTOSchema = z
  .object({
    id: z.string(),
    nostrEventId: z.string().nullable().optional(),
    title: z
      .string()
      .nullish()
      .transform((val) => val ?? null),
    summary: z.string().nullable().optional(),
    content: z
      .string()
      .nullish()
      .transform((val) => val ?? null),
    image: z.string().nullable().optional(),
    scheduledAtUtc: z.string().nullable(),
    postedAt: z.string().nullable(),
    publishedAt: z.string().nullable(),
    updatedAt: z.string(),
    createdAt: z.string(),
    status: z.enum([
      "DRAFT",
      "ACTIVE",
      "SCHEDULED",
      "PAUSED",
      "POSTED",
      "FAILED",
    ]),
    currentState: z.string(),
    queueTypeId: z.string().nullable().optional(),
    tags: z.array(z.string()),
    signedEvent: signedEventSchema.nullable().optional(),
    nostrEvent: nostrEventSchema.nullable().optional(),
    userId: z.string(),
    hashTagPresetId: z.string().nullable().optional(),
    queueType: queueTypeSchema.nullable().optional(),
  })
  .passthrough(); // Allow additional fields

/**
 * Schema for CombinedContent (simplified - just validates structure)
 */
const _combinedContentSchema = z
  .object({
    id: z.string(),
    type: z.enum(["post", "longform"]),
    title: z.string().optional(),
    caption: z.string().optional(),
    content: z.string().optional(),
    summary: z.string().optional(),
    image: z.string().optional(),
    fileUrl: z.array(z.string()).optional(),
    scheduledAtUtc: z.union([z.string(), z.date()]).nullable().optional(),
    publishedAt: z.union([z.string(), z.date()]).optional(),
    createdAt: z.union([z.string(), z.date()]),
    updatedAt: z.union([z.string(), z.date()]),
    status: z.string(),
    currentState: z.string().optional(),
    queueType: queueTypeSchema.nullable().optional(),
    originalData: z.unknown(), // Allow any original data
  })
  .passthrough(); // Allow additional fields

/**
 * Schema for PublishedPostsLoaderData
 * Note: allContent is removed - reconstruct on client from posts/longformPosts
 */
export const publishedPostsLoaderDataSchema = z.object({
  posts: z.array(postDTOSchema),
  longformPosts: z.array(longFormPostDTOSchema),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  pagination: paginationSchema,
  stats: z.record(z.string(), postStatsSchema),
  selectedQueueType: z.string().optional(),
  longformPagination: paginationSchema.optional(),
  totalPostsCount: z.number().int().min(0).optional(),
  totalRepostsCount: z.number().int().min(0).optional(),
  totalLongformCount: z.number().int().min(0).optional(),
  totalContentCount: z.number().int().min(0).optional(),
});

export type PublishedPostsLoaderData = z.infer<
  typeof publishedPostsLoaderDataSchema
>;

/**
 * Schema for UserWithHashTagPresets (extends userSchema)
 */
const userWithHashTagPresetsSchema = userSchema.extend({
  hashTagPresets: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      tags: z.string(),
      description: z.string().nullable().optional(),
    })
  ),
});

/**
 * Schema for RecyclablesLoaderData
 */
export const recyclablesLoaderDataSchema = z.object({
  posts: z.array(postDTOSchema),
  pagination: paginationSchema,
  stats: z.record(z.string(), postStatsSchema),
  user: userWithHashTagPresetsSchema,
  queueTypes: z.array(queueTypeSchema),
  selectedQueueType: z.string(),
});

export type RecyclablesLoaderData = z.infer<typeof recyclablesLoaderDataSchema>;

/**
 * Schema for DraftsLoaderData
 * Note: allContent is removed - reconstruct on client from posts/longformPosts
 */
export const draftsLoaderDataSchema = z.object({
  posts: z.array(postDTOSchema),
  longformPosts: z.array(longFormPostDTOSchema),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  selectedQueueType: z.string(),
  pagination: paginationSchema,
  longformPagination: paginationSchema.optional(),
  bulkDraftGroups: z
    .array(
      z.object({
        id: z.string(),
        postCount: z.number(),
        updatedAt: z.string(),
      })
    )
    .optional()
    .default([]),
});

export type DraftsLoaderData = z.infer<typeof draftsLoaderDataSchema>;

/**
 * Schema for Template
 */
const templateSchema = z
  .object({
    id: z.string(),
    name: z.string().nullable().optional(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
    userId: z.string(),
  })
  .passthrough();

/**
 * Schema for TemplatesLoaderData
 */
export const templatesLoaderDataSchema = z.object({
  templates: z.array(templateSchema),
  user: userSchema.nullable(),
});

export type TemplatesLoaderData = z.infer<typeof templatesLoaderDataSchema>;

/**
 * Schema for EventStats (from engagement feature)
 */
const eventStatsSchema = z.object({
  likes: z.number(),
  replies: z.number(),
  mentions: z.number(),
  reposts: z.number(),
  zaps: z.number(),
  satszapped: z.number(),
});

/**
 * Schema for ParentPost
 */
const parentPostSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  pubkey: z.string(),
  caption: z.string().nullable().optional(),
  fileUrl: z
    .union([z.string(), z.array(z.string())])
    .nullable()
    .optional(),
  title: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  publishedAt: z.string().nullable(), // ISO string
  isLongform: z.boolean(),
  stats: eventStatsSchema.optional(),
});

/**
 * Schema for GroupedNotification (matches actual structure)
 */
const groupedNotificationSchema = z.object({
  parentPost: parentPostSchema,
  notifications: z.array(z.unknown()), // Notifications are complex, use unknown for flexibility
});

/**
 * Schema for EngagementLoaderData
 */
export const engagementLoaderDataSchema = z.object({
  posts: z.array(postDTOSchema), // Posts are PostDTOs in loader
  stats: z.record(z.string(), eventStatsSchema),
  user: z.record(z.string(), z.unknown()).nullable(),
  notifications: z.object({
    all: z.array(z.unknown()),
    replies: z.array(z.unknown()),
    mentions: z.array(z.unknown()),
    zaps: z.array(z.unknown()),
    quotes: z.array(z.unknown()),
  }),
  groupedNotifications: z.object({
    replies: z.array(groupedNotificationSchema),
    quotes: z.array(groupedNotificationSchema),
  }),
  trustScores: z.record(z.string(), z.number()),
});

export type EngagementLoaderData = z.infer<typeof engagementLoaderDataSchema>;

/**
 * Schema for CalendarQueueLoaderData
 */
export const calendarQueueLoaderDataSchema = z.object({
  scheduledPosts: z.array(postDTOSchema),
  user: userWithHashTagPresetsSchema,
  queueTypes: z.array(queueTypeSchema),
  selectedQueueType: z.string(),
  scheduleIntervals: z.array(z.number()),
});

export type CalendarQueueLoaderData = z.infer<
  typeof calendarQueueLoaderDataSchema
>;

/**
 * Schema for RelatedEvent (from giveaway feature)
 */
const relatedEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  content: z.string().optional(),
  tags: z.array(z.array(z.string())).optional(),
  sig: z.string().optional(),
});

/**
 * Schema for PostDTO with stats (for giveaway)
 */
const postDTOWithStatsSchema = postDTOSchema.extend({
  stats: postStatsSchema.optional(),
  totalEngagement: z.number().optional(),
});

/**
 * Schema for GiveawayLoaderData
 */
export const giveawayLoaderDataSchema = z.object({
  posts: z.array(postDTOWithStatsSchema),
  stats: z.record(z.string(), postStatsSchema),
  relatedEvents: z.array(relatedEventSchema),
  user: userWithHashTagPresetsSchema,
  queueTypes: z.array(queueTypeSchema),
  selectedQueueType: z.string(),
});

export type GiveawayLoaderData = z.infer<typeof giveawayLoaderDataSchema>;

/**
 * Schema for HashTagPreset
 */
/**
 * Schema for HashTagPreset
 * Validates HashTagPreset structure from Prisma/loader responses
 */
export const hashTagPresetSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    tags: z.string(),
    description: z.string().nullable().optional(),
    createdAt: z.string().or(z.date()),
    updatedAt: z.string().or(z.date()),
    userId: z.string(),
  })
  .passthrough();

/**
 * Schema for ScheduledPostsLoaderData
 * Note: allContent is removed - reconstruct on client from posts/longformPosts
 */
export const scheduledPostsLoaderDataSchema = z.object({
  posts: z.array(postDTOSchema),
  longformPosts: z.array(longFormPostDTOSchema),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  selectedQueueType: z.string(),
  hashTagPresets: z.array(hashTagPresetSchema),
  pagination: paginationSchema,
  longformPagination: paginationSchema.optional(),
  totalPostsCount: z.number().int().min(0).optional(),
  totalRepostsCount: z.number().int().min(0).optional(),
  totalLongformCount: z.number().int().min(0).optional(),
  totalContentCount: z.number().int().min(0).optional(),
});

export type ScheduledPostsLoaderData = z.infer<
  typeof scheduledPostsLoaderDataSchema
>;

/**
 * Schema for DashboardLoaderData
 * Note: allContent is removed - reconstruct on client from scheduledPosts/longformPosts
 */
export const dashboardLoaderDataSchema = z.object({
  scheduledPosts: z.array(postDTOSchema),
  longformPosts: z.array(longFormPostDTOSchema),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  hashTagPresets: z.array(hashTagPresetSchema),
  postStatistics: z
    .object({
      scheduledCount: z.number(),
      successCount: z.number(),
    })
    .optional(),
  selectedQueueType: z.string(),
  planActivated: z.string().nullable().optional(),
  successMessage: z.string().nullable().optional(),
  pagination: paginationSchema,
  longformPagination: paginationSchema.optional(),
});

export type DashboardLoaderData = z.infer<typeof dashboardLoaderDataSchema>;

/**
 * Schema for CalendarLoaderData
 * Note: allContent is removed - reconstruct on client from posts
 */
export const calendarLoaderDataSchema = z.object({
  scheduledPosts: z.array(postDTOSchema),
  scheduledLongFormPosts: z.array(longFormPostDTOSchema),
  pastPosts: z.array(postDTOSchema),
  pastLongFormPosts: z.array(longFormPostDTOSchema),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  selectedQueueType: z.string(),
  scheduleIntervals: z.array(z.union([z.string(), z.number()])).optional(),
  scheduledPostsPagination: paginationSchema.optional(),
  scheduledLongFormPostsPagination: paginationSchema.optional(),
});

export type CalendarLoaderData = z.infer<typeof calendarLoaderDataSchema>;

/**
 * Flow item: post or longform DTO with type discriminator
 */
const flowItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("post"),
    data: postDTOSchema,
  }),
  z.object({
    type: z.literal("longform"),
    data: longFormPostDTOSchema,
  }),
]);

/** Runway settings (dashboard index may include for modal initial state) */
export const runwaySettingsSchema = z.object({
  queueNames: z.array(z.string()),
  mode: z.enum(["last-post", "first-queue-empty"]),
  redThresholdDays: z.number().int().min(0).max(365).optional(),
  orangeThresholdDays: z.number().int().min(0).max(365).optional(),
  /** Target posts per day for schedule overview (0–10); 0 = off. */
  targetPostsPerDay: z.number().int().min(0).max(10).optional(),
});

/**
 * Schema for Flow loader data (dashboard Flow view).
 * Optional runway fields are set by dashboard index loader only.
 */
export const flowLoaderDataSchema = z.object({
  flowItems: z.array(flowItemSchema),
  hasMorePast: z.boolean(),
  hasMoreFuture: z.boolean(),
  pastCursor: z.string().nullable(),
  futureCursor: z.string().nullable(),
  /** Latest scheduled date (ms) for runway KPI; null when no future scheduled. */
  lastScheduledAtUtc: z.number().nullable(),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  hashTagPresets: z.array(hashTagPresetSchema),
  /** Runway KPI: computed from user runway settings; only from dashboard index loader. */
  runwayLastScheduledAtUtc: z.number().nullable().optional(),
  /** Runway settings for modal; only from dashboard index loader. */
  runwaySettings: runwaySettingsSchema.optional(),
  /** Total counts for full flow window (only on initial load). */
  flowTotalCount: z.number().int().min(0).optional(),
  flowPostsCount: z.number().int().min(0).optional(),
  flowRepostsCount: z.number().int().min(0).optional(),
  flowLongformCount: z.number().int().min(0).optional(),
});

export type FlowLoaderData = z.infer<typeof flowLoaderDataSchema>;
