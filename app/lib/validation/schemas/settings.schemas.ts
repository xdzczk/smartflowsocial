/**
 * Zod validation schemas for settings forms
 * These schemas are shared between client and server for consistent validation
 */

import { z } from "zod";

/**
 * Relay URL validation schema
 * Validates Nostr relay URLs (wss:// format)
 */
export const relayUrlSchema = z
  .string()
  .regex(
    /^wss:\/\/[a-zA-Z0-9][a-zA-Z0-9-._]+\.[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/,
    "Must start with wss:// and have a valid domain",
  );

/**
 * Timezone update schema
 */
export const updateTimezoneSchema = z.object({
  timezone: z.string().min(1, "Timezone is required"),
});

/**
 * Relays update schema
 */
export const updateRelaysSchema = z.object({
  relays: z
    .string()
    .transform((val) => val.split("\n").filter((relay) => relay.trim()))
    .pipe(z.array(relayUrlSchema).min(0)),
});

/**
 * Blacklist update schema
 * Validates npub addresses for giveaway blacklist
 */
export const updateBlacklistSchema = z.object({
  blacklist: z
    .string()
    .transform((val) => val.split("\n").filter((item) => item.trim()))
    .pipe(
      z
        .array(z.string().startsWith("npub", "All blacklist items must start with npub"))
        .min(0),
    ),
});

/**
 * Schedule intervals update schema
 * Validates positive whole numbers for schedule intervals
 */
export const updateScheduleIntervalsSchema = z.object({
  scheduleIntervals: z
    .string()
    .transform((val) => val.split("\n").filter((interval) => interval.trim()))
    .pipe(
      z
        .array(
          z
            .string()
            .regex(/^\d+$/, "Must be a positive whole number")
            .transform((val) => parseInt(val, 10))
            .pipe(z.number().int().positive("Must be a positive whole number")),
        )
        .min(0),
    ),
});

/**
 * Hashtag preset schemas
 */
export const createHashtagPresetSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tags: z.string().trim().min(1, "Tags are required"),
  description: z.string().optional(),
});

export const updateHashtagPresetSchema = z.object({
  id: z.string().min(1, "ID is required"),
  name: z.string().trim().min(1, "Name is required"),
  tags: z.string().trim().min(1, "Tags are required"),
  description: z.string().optional(),
});

export const deleteHashtagPresetSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

/**
 * Storage settings schemas
 */
export const uploadProviderSchema = z.enum(["S3", "BLOSSOM_PRIMAL", "BLOSSOM_BLOSSTR"]);

export const updateUploadProviderSchema = z.object({
  uploadProvider: uploadProviderSchema,
});

export const updateBlossomMirrorsSchema = z.object({
  enableMirrorBlossom: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => val === "on" || val === "true" || val === true),
  mirrorUrls: z
    .string()
    .optional()
    .transform((val) => (val ? val.split("\n").filter((url) => url.trim()) : []))
    .pipe(
      z
        .array(
          z
            .string()
            .refine(
              (url) => url.startsWith("https://"),
              "All mirror URLs must start with https://",
            )
            .refine(
              (url) => {
                try {
                  new URL(url);
                  return true;
                } catch {
                  return false;
                }
              },
              "Invalid URL format",
            )
            .transform((url) => (url.endsWith("/") ? url.slice(0, -1) : url)),
        )
        .min(0),
    ),
});

/**
 * Queue type schemas
 */
export const scheduleTypeSchema = z.enum(["INTERVAL", "FIXED_SLOTS"]);

export const createQueueTypeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    scheduleType: scheduleTypeSchema,
    color: z.string().min(1, "Color is required"),
    description: z.string().optional(),
    hashTagPresetId: z
      .string()
      .nullable()
      .optional()
      .transform((val) => (val === "none" || !val || val === undefined ? null : val)),
    intervalHours: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    useGlobalInterval: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform((val) => val === "on" || val === "true" || val === true),
    slots: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s)
          : undefined,
      )
      .pipe(z.array(z.string()).optional()),
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

export const updateQueueTypeSchema = z
  .object({
    id: z.string().min(1, "ID is required"),
    name: z.string().trim().min(1, "Name is required"),
    scheduleType: scheduleTypeSchema,
    color: z.string().min(1, "Color is required"),
    description: z.string().optional(),
    isEnabled: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform((val) => val === "on" || val === "true" || val === true),
    hashTagPresetId: z
      .string()
      .nullable()
      .optional()
      .transform((val) => (val === "none" || !val || val === undefined ? null : val)),
    intervalHours: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : undefined))
      .pipe(z.number().int().positive().optional()),
    useGlobalInterval: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform((val) => val === "on" || val === "true" || val === true),
    slots: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s)
          : undefined,
      )
      .pipe(z.array(z.string()).optional()),
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

export const deleteQueueTypeSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

/**
 * Accounts action schemas
 */
export const searchAccountsSchema = z.object({
  q: z.string().optional().default(""),
});

export const childNpubSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, "Invalid hex pubkey format (must be 64 hex characters)");

export const requestChildSchema = z.object({
  childNpub: childNpubSchema,
});

export const cancelChildRequestSchema = z.object({
  childNpub: childNpubSchema,
});

export const unlinkChildSchema = z.object({
  childNpub: childNpubSchema,
});

/**
 * Engagement action schemas
 */
export const toggleFilterMutedSchema = z.object({
  filterMuted: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean()),
});

export const toggleHideLowTrustSchema = z.object({
  hidePostsFromLowTrustUsers: z
    .string()
    .transform((val) => val === "true")
    .pipe(z.boolean()),
});

/**
 * NWC (Nostr Wallet Connect) action schemas
 */
export const updateNWCSchema = z.object({
  nwcEnabled: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform((val) => val === "on" || val === "true" || val === true)
    .pipe(z.boolean()),
  nwcString: z.string().optional(),
});

/**
 * Hashtags update schema
 */
export const updateTagsSchema = z.object({
  hashtags: z.string().optional(),
  showHashTagsInPosts: z.coerce.boolean().default(false).optional(),
});

/**
 * Subscription action schemas
 */
export const switchToFreePlanSchema = z.object({
  planId: z.string().min(1, "Plan ID is required"),
});

