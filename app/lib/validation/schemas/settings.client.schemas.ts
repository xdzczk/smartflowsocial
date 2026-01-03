/**
 * Client-side Zod validation schemas for settings forms
 * These schemas are optimized for React Hook Form (work with arrays/objects directly)
 */

import { z } from "zod";

/**
 * Relays update schema for client-side forms
 * Works with array of strings directly (not newline-separated)
 * Allows empty strings for form editing, but validates non-empty strings
 * Note: Validation happens on submit, empty strings are filtered out
 */
export const updateRelaysClientSchema = z.object({
  relays: z.array(z.string()),
});

/**
 * Timezone update schema (same as server)
 */
export const updateTimezoneClientSchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
});


/**
 * Schedule intervals update schema for client-side forms
 * Works with array of strings (converted to numbers on submit)
 */
export const updateScheduleIntervalsClientSchema = z.object({
  scheduleIntervals: z.array(z.string()),
});

/**
 * Blacklist update schema for client-side forms
 * Works with array of strings directly
 */
export const updateBlacklistClientSchema = z.object({
  blacklist: z.array(z.string()),
});

/**
 * Hashtag preset create schema for client-side forms
 */
export const createHashtagPresetClientSchema = z.object({
  name: z.string().min(1, "Name is required").trim(),
  tags: z.string().min(1, "Tags are required").trim(),
  description: z.string().optional(),
});

/**
 * Hashtag preset update schema for client-side forms
 */
export const updateHashtagPresetClientSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required").trim(),
  tags: z.string().min(1, "Tags are required").trim(),
  description: z.string().optional(),
});

/**
 * Blossom mirrors update schema for client-side forms
 * Works with array of strings directly (not newline-separated)
 * Allows empty strings for form editing, but validates non-empty strings
 */
export const updateBlossomMirrorsClientSchema = z.object({
  enableMirrorBlossom: z.boolean(),
  mirrorUrls: z.array(z.string()),
});

/**
 * NWC update schema for client-side forms
 */
export const updateNWCClientSchema = z.object({
  nwcEnabled: z.boolean(),
  nwcString: z.string().optional(),
});

/**
 * Hashtags update schema for client-side forms
 */
export const updateTagsClientSchema = z.object({
  hashtags: z.string().optional(),
  showHashTagsInPosts: z.boolean().default(false),
});

/**
 * Queue type create/update schema for client-side forms
 * Works with form values directly (not transformed from FormData)
 * Note: intervalHours and slots are kept as strings for form inputs, transformed on submit
 */
export const queueTypeClientSchema = z
  .object({
    name: z.string().min(1, "Name is required").trim(),
    description: z.string().optional(),
    color: z.string().min(1, "Color is required"),
    hashTagPresetId: z.string().optional(),
    scheduleType: z.enum(["INTERVAL", "FIXED_SLOTS"]),
    isEnabled: z.boolean().optional(),
    useGlobalInterval: z.boolean().optional(),
    intervalHours: z.string().optional(),
    slots: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.scheduleType === "INTERVAL") {
        return data.useGlobalInterval === true || data.intervalHours !== undefined;
      }
      return true;
    },
    {
      message: "Interval hours or use global interval is required for INTERVAL schedule type",
      path: ["intervalHours"],
    },
  )
  .refine(
    (data) => {
      if (data.scheduleType === "FIXED_SLOTS") {
        return data.slots !== undefined && data.slots.length > 0;
      }
      return true;
    },
    {
      message: "Slots are required for FIXED_SLOTS schedule type",
      path: ["slots"],
    },
  );

