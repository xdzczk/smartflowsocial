/**
 * Client-side Zod validation schemas for post forms
 * These schemas are optimized for React Hook Form
 */

import { z } from "zod";

/**
 * Text post client schema
 * For use with React Hook Form - works with form values directly
 */
export const textPostClientSchema = z.object({
  content: z.string().min(1, "Post content cannot be empty").max(5000, "Content too long"),
  scheduledFor: z.string().optional(),
  queueType: z.string().default("unassigned"),
  isRecyclable: z.boolean().default(false),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().optional(),
});

/**
 * Edit post client schema (for regular posts)
 */
export const editPostClientSchema = z.object({
  caption: z.string().max(5000, "Caption too long").optional(),
  queueType: z.string().optional(),
  scheduledFor: z.string().optional(),
  isRecyclable: z.boolean().default(false),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().optional(),
  manualHashtags: z.string().optional(),
});

/**
 * Edit longform post client schema
 */
export const editLongformPostClientSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  summary: z.string().max(500, "Summary too long").optional(),
  content: z.string().min(1, "Content is required"),
  image: z.string().optional(),
  scheduledFor: z.string().optional(),
  queueType: z.string().optional(),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().optional(),
  customTags: z.string().optional(),
});

/**
 * Longform post client schema (for new posts)
 */
export const longformPostClientSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  summary: z.string().max(500, "Summary too long").optional(),
  content: z.string().min(1, "Content is required"),
  customTags: z.string().optional(),
  scheduledFor: z.string().optional(),
  queueType: z.string().default("Unassigned"),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().optional(),
});

/**
 * Draft edit client schema
 * For editing draft posts (content, queue, scheduling, hashtags)
 */
export const draftEditClientSchema = z.object({
  content: z.string().min(1, "Content is required"),
  selectedQueue: z.string().default("unassigned"),
  scheduledFor: z.string().optional(),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().nullable().optional(),
});

