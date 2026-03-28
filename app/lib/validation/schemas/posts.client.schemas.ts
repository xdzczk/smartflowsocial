/**
 * Client-side Zod validation schemas for post forms
 * These schemas are optimized for React Hook Form
 */

import { z } from "zod";

/**
 * Validation message constants
 */
const VALIDATION_TITLE_REQUIRED = "Title is required";
const VALIDATION_TITLE_TOO_LONG = "Title too long";
const VALIDATION_CONTENT_REQUIRED = "Content is required";

/**
 * Text post client schema
 * For use with React Hook Form - works with form values directly
 */
export const textPostClientSchema = z.object({
  // Optional so thread mode can submit (content lives in segments); single-post path validates in submit
  content: z.string().max(5000, "Content too long").default(""),
  scheduledFor: z.string().optional(),
  queueType: z.string().default("unassigned"),
  isRecyclable: z.boolean().default(false),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().optional(),
  /** When false, tags are only on the event as `t` tags (subject to account default). */
  includeHashtagsInNoteBody: z.boolean().default(true),
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
  includeHashtagsInNoteBody: z.boolean().default(true),
});

/**
 * Edit longform post client schema
 */
export const editLongformPostClientSchema = z.object({
  title: z
    .string()
    .min(1, VALIDATION_TITLE_REQUIRED)
    .max(200, VALIDATION_TITLE_TOO_LONG),
  summary: z.string().max(500, "Summary too long").optional(),
  content: z.string().min(1, VALIDATION_CONTENT_REQUIRED),
  image: z.string().optional(),
  scheduledFor: z.string().optional(),
  queueType: z.string().optional(),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().optional(),
  customTags: z.string().optional(),
  includeHashtagsInNoteBody: z.boolean().default(true),
});

/**
 * Longform post client schema (for new posts)
 */
export const longformPostClientSchema = z.object({
  title: z
    .string()
    .min(1, VALIDATION_TITLE_REQUIRED)
    .max(200, VALIDATION_TITLE_TOO_LONG),
  summary: z.string().max(500, "Summary too long").optional(),
  content: z.string().min(1, VALIDATION_CONTENT_REQUIRED),
  customTags: z.string().optional(),
  scheduledFor: z.string().optional(),
  queueType: z.string().default("Unassigned"),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().optional(),
  includeHashtagsInNoteBody: z.boolean().default(true),
});

/**
 * Draft edit client schema
 * For editing draft posts (content, queue, scheduling, hashtags)
 */
export const draftEditClientSchema = z.object({
  content: z.string().min(1, VALIDATION_CONTENT_REQUIRED),
  selectedQueue: z.string().default("unassigned"),
  scheduledFor: z.string().optional(),
  useHashtagPresets: z.boolean().default(false),
  hashTagPresetId: z.string().nullable().optional(),
  includeHashtagsInNoteBody: z.boolean().default(true),
});
