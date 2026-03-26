/**
 * Zod schemas for search result data validation
 * Replaces unsafe type casts with runtime validation
 */

import { z } from "zod";

/**
 * Schema for search event (from fetcher)
 */
export const searchEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  content: z.string(),
  tags: z.array(z.array(z.string())),
  mediaUrls: z.array(z.string()).optional(),
  /** Present on server search results; must be kept through parse (Zod strips unknown keys). */
  authorName: z.string(),
  authorImage: z.string().nullable(),
});

/**
 * Schema for search stats
 */
export const searchStatsSchema = z.object({
  likes: z.number(),
  replies: z.number(),
  mentions: z.number(),
  reposts: z.number(),
  zaps: z.number(),
  satszapped: z.number(),
});

/** Direct reply to the viewed note (from Primal thread_view). */
export const searchReplyItemSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  content: z.string(),
  authorName: z.string(),
  authorImage: z.string().nullable(),
  mediaUrls: z.array(z.string()).optional(),
});

/**
 * Schema for search result data from fetcher
 */
export const searchResultDataSchema = z.object({
  event: searchEventSchema.optional(),
  stats: searchStatsSchema.optional(),
  replies: z.array(searchReplyItemSchema).optional(),
  error: z.string().optional(),
});

/**
 * Schema for search result display (with author info)
 */
export const searchResultDisplaySchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  content: z.string(),
  tags: z.array(z.array(z.string())),
  authorName: z.string(),
  authorImage: z.string().nullable(),
  mediaUrls: z.array(z.string()),
});
