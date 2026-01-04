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
  description: z.string().nullable().optional(),
  scheduleType: z.enum(["INTERVAL", "FIXED_SLOTS"]).optional(),
  scheduleConfig: z
    .object({
      useGlobalInterval: z.boolean().optional(),
      intervalHours: z.number().optional(),
      slots: z.array(z.string()).optional(),
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
  userRelays: z.array(z.string()),
  giveawayBlackListed: z.array(z.string()),
  uploadProvider: z.enum(["S3", "BLOSSOM_PRIMAL", "BLOSSOM_BLOSSTR"]),
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
const signedEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
}).passthrough(); // Allow additional fields

/**
 * Schema for NostrEvent (minimal validation)
 */
const nostrEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
}).passthrough(); // Allow additional fields

/**
 * Schema for PostDTO
 */
const postDTOSchema = z.object({
  id: z.string(),
  nostrEventId: z.string().nullable().optional(),
  caption: z.string().nullish().transform(val => val ?? null),
  fileUrl: z.array(z.string()),
  scheduledFor: z.string().nullable(),
  postedAt: z.string().nullable(),
  content: z.string().nullish().transform(val => val ?? null),
  isPosted: z.boolean(),
  isScheduled: z.boolean(),
  postType: z.enum(["IMAGE", "CAROUSEL", "TEXT", "VIDEO"]),
  repost: z.boolean(),
  isQuotedPost: z.boolean(),
  isRecyclable: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  draft: z.boolean(),
  status: z.enum(["DRAFT", "ACTIVE", "SCHEDULED", "PAUSED", "POSTED", "FAILED"]),
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
}).passthrough(); // Allow additional fields

/**
 * Schema for LongFormPostDTO
 */
const longFormPostDTOSchema = z.object({
  id: z.string(),
  nostrEventId: z.string().nullable().optional(),
  title: z.string().nullish().transform(val => val ?? null),
  summary: z.string().nullable().optional(),
  content: z.string().nullish().transform(val => val ?? null),
  image: z.string().nullable().optional(),
  scheduledFor: z.string().nullable(),
  isScheduled: z.boolean(),
  postedAt: z.string().nullable(),
  publishedAt: z.string().nullable(),
  updatedAt: z.string(),
  createdAt: z.string(),
  isPublished: z.boolean(),
  draft: z.boolean(),
  status: z.enum(["DRAFT", "ACTIVE", "SCHEDULED", "PAUSED", "POSTED", "FAILED"]),
  queueTypeId: z.string().nullable().optional(),
  tags: z.array(z.string()),
  signedEvent: signedEventSchema.nullable().optional(),
  nostrEvent: nostrEventSchema.nullable().optional(),
  userId: z.string(),
  hashTagPresetId: z.string().nullable().optional(),
  queueType: queueTypeSchema.nullable().optional(),
}).passthrough(); // Allow additional fields

/**
 * Schema for CombinedContent (simplified - just validates structure)
 */
const _combinedContentSchema = z.object({
  id: z.string(),
  type: z.enum(["post", "longform"]),
  title: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
  summary: z.string().optional(),
  image: z.string().optional(),
  fileUrl: z.array(z.string()).optional(),
  scheduledFor: z.string().optional(),
  publishedAt: z.union([z.string(), z.date()]).optional(),
  postedAt: z.union([z.string(), z.date()]).optional(),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
  isScheduled: z.boolean().optional(),
  isPosted: z.boolean().optional(),
  isPublished: z.boolean().optional(),
  draft: z.boolean().optional(),
  status: z.string(),
  queueType: queueTypeSchema.nullable().optional(),
  originalData: z.unknown(), // Allow any original data
}).passthrough(); // Allow additional fields

/**
 * Schema for PostedPostsLoaderData
 * Note: allContent is removed - reconstruct on client from posts/longformPosts
 */
export const postedPostsLoaderDataSchema = z.object({
  posts: z.array(postDTOSchema),
  longformPosts: z.array(longFormPostDTOSchema),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  pagination: paginationSchema,
  stats: z.record(z.string(), postStatsSchema),
  selectedQueueType: z.string().optional(),
  longformPagination: paginationSchema.optional(),
});

export type PostedPostsLoaderData = z.infer<typeof postedPostsLoaderDataSchema>;

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
    }),
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
});

export type DraftsLoaderData = z.infer<typeof draftsLoaderDataSchema>;

/**
 * Schema for Template
 */
const templateSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  userId: z.string(),
}).passthrough();

/**
 * Schema for Asset
 */
const assetSchema = z.object({
  id: z.string(),
  title: z.string().nullish().transform(val => val ?? null),
  content: z.string().nullish().transform(val => val ?? null),
  fileUrl: z.string().nullish().transform(val => val ?? null),
  tags: z.array(z.string()),
  assetType: z.enum(["TEXT", "IMAGE", "VIDEO"]),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  userId: z.string(),
}).passthrough();

/**
 * Schema for TemplatesLoaderData
 */
export const templatesLoaderDataSchema = z.object({
  templates: z.array(templateSchema),
  user: userSchema.nullable(),
  assets: z.array(assetSchema),
  totalCount: z.number(),
  totalPages: z.number(),
  currentPage: z.number(),
  searchTerm: z.string(),
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
 * Schema for GroupedNotification (simplified - allows passthrough for flexibility)
 */
const groupedNotificationSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  pubkey: z.string(),
  createdAt: z.number(),
  kind: z.number(),
  content: z.string().optional(),
  tags: z.array(z.array(z.string())).optional(),
}).passthrough();

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

export type CalendarQueueLoaderData = z.infer<typeof calendarQueueLoaderDataSchema>;

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
export const hashTagPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.string(),
  description: z.string().nullable().optional(),
  createdAt: z.string().or(z.date()),
  updatedAt: z.string().or(z.date()),
  userId: z.string(),
}).passthrough();

/**
 * Schema for ScheduledPostsLoaderData
 * Note: allContent is removed - reconstruct on client from posts/longformPosts
 */
export const scheduledPostsLoaderDataSchema = z.object({
  posts: z.array(postDTOSchema),
  longformPosts: z.array(longFormPostDTOSchema),
  user: userSchema.nullable(),
  queueTypes: z.array(queueTypeSchema),
  selectedQueueType: z.string().optional(),
  hashTagPresets: z.array(hashTagPresetSchema),
});

export type ScheduledPostsLoaderData = z.infer<typeof scheduledPostsLoaderDataSchema>;

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
  postStatistics: z.object({
    totalScheduled: z.number(),
    totalDrafts: z.number(),
    totalPosted: z.number(),
  }).optional(),
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
});

export type CalendarLoaderData = z.infer<typeof calendarLoaderDataSchema>;

