/**
 * Zod validation schemas for settings forms
 * These schemas are shared between client and server for consistent validation
 */

import { z } from "zod";

import { isAllowedScheduleInterval } from "~/lib/schedule-intervals";

const NPUB_PREFIX = "npub";
const ERROR_NPUB_REQUIRED = "All blacklist items must start with npub";

// Validation error messages
const ERROR_NAME_REQUIRED = "Name is required";
const ERROR_TAGS_REQUIRED = "Tags are required";
const ERROR_ID_REQUIRED = "ID is required";
const _ERROR_COLOR_TOKEN_REQUIRED = "Queue color is required";
const ERROR_TIMEZONE_REQUIRED = "Timezone is required";
const ERROR_SCHEDULE_INTERVAL_ALLOWED =
  "Schedule interval must be 0.25 (15 min), 0.5 (30 min), or a whole number of hours";
const ERROR_MIRROR_URLS_HTTPS = "All mirror URLs must start with https://";
const ERROR_INVALID_URL_FORMAT = "Invalid URL format";
const ERROR_CUSTOM_BLOSSOM_URL_REQUIRED =
  "Custom Blossom URL is required when Custom Blossom is selected";
const ERROR_CUSTOM_BLOSSOM_URL_HTTPS =
  "Custom Blossom URL must start with https://";
const ERROR_BUNKER_INPUT_REQUIRED =
  "Bunker input is required for bunker primary signer";
const ERROR_NOSTRCONNECT_URI_REQUIRED =
  "nostrconnect URI is required for URI primary signer";
const ERROR_PRIMARY_RELAYS_REQUIRED =
  "At least one relay is required for URI primary signer";

// Form value constants
const FORM_VALUE_ON = "on";
const FORM_VALUE_TRUE = "true";
const canonicalPlanIdSchema = z.enum([
  "free",
  "starter",
  "creator",
  "pro",
  "teams",
  "founder",
]);

/**
 * Relay URL validation schema
 * Validates Nostr relay URLs (wss:// format)
 */
export const relayUrlSchema = z
  .string()
  .regex(
    /^wss:\/\/[a-zA-Z0-9][a-zA-Z0-9-._]+\.[a-zA-Z]{2,}(:[0-9]+)?(\/.*)?$/,
    "Must start with wss:// and have a valid domain"
  );

/**
 * Timezone update schema
 */
export const updateTimezoneSchema = z.object({
  timezone: z.string().min(1, ERROR_TIMEZONE_REQUIRED),
});

export const updateThemePreferenceSchema = z.object({
  themePreference: z.enum(["system", "light", "dark"]),
});

const publishRelaySourceSchema = z.enum(["app", "nip65_profile"]);

/**
 * Relays update schema
 */
export const updateRelaysSchema = z.object({
  relays: z
    .string()
    .transform((val) => val.split("\n").filter((relay) => relay.trim()))
    .pipe(z.array(relayUrlSchema).min(1, "At least one relay is required")),
  publishRelaySource: publishRelaySourceSchema
    .optional()
    .default("nip65_profile"),
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
      z.array(z.string().startsWith(NPUB_PREFIX, ERROR_NPUB_REQUIRED)).min(0)
    ),
});

/**
 * Schedule intervals update schema
 * Validates 0.25, 0.5, and positive whole hours only (no arbitrary decimals).
 */
export const updateScheduleIntervalsSchema = z.object({
  scheduleIntervals: z
    .string()
    .transform((val) =>
      val
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
    )
    .pipe(
      z
        .array(
          z.string().superRefine((line, ctx) => {
            const num = Number(line);
            if (!Number.isFinite(num) || Number.isNaN(num)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Must be a number",
              });
              return;
            }
            if (num <= 0) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Must be positive",
              });
              return;
            }
            if (!isAllowedScheduleInterval(num)) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: ERROR_SCHEDULE_INTERVAL_ALLOWED,
              });
            }
          })
        )
        .min(1, "At least one schedule interval is required")
    ),
});

const PREFERRED_NOSTR_CLIENT_ENUM = z.enum([
  "PRIMAL",
  "DAMUS",
  "AMETHYST",
  "NOSTUR",
  "NOSTRUDEL",
  "IRIS",
  "YAKIHONNE",
  "JUMBLE",
  "CUSTOM",
]);

/**
 * Preferred Nostr client update schema.
 * When CUSTOM, customNostrClientBaseUrl must be a valid https URL.
 */
export const updatePreferredNostrClientSchema = z
  .object({
    preferredNostrClient: PREFERRED_NOSTR_CLIENT_ENUM,
    customNostrClientBaseUrl: z
      .string()
      .optional()
      .transform((val) => {
        const trimmed = (val ?? "").trim();
        return trimmed === "" ? null : trimmed;
      }),
  })
  .superRefine((data, ctx) => {
    if (data.preferredNostrClient !== "CUSTOM") return;
    if (data.customNostrClientBaseUrl == null) return;
    if (!data.customNostrClientBaseUrl.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customNostrClientBaseUrl"],
        message: "Custom client URL must start with https://",
      });
      return;
    }
    try {
      new URL(data.customNostrClientBaseUrl);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customNostrClientBaseUrl"],
        message: ERROR_INVALID_URL_FORMAT,
      });
    }
  });

/**
 * Hashtag preset schemas
 */
export const createHashtagPresetSchema = z.object({
  name: z.string().trim().min(1, ERROR_NAME_REQUIRED),
  tags: z.string().trim().min(1, ERROR_TAGS_REQUIRED),
  description: z.string().optional(),
});

export const updateHashtagPresetSchema = z.object({
  id: z.string().min(1, ERROR_ID_REQUIRED),
  name: z.string().trim().min(1, ERROR_NAME_REQUIRED),
  tags: z.string().trim().min(1, ERROR_TAGS_REQUIRED),
  description: z.string().optional(),
});

export const deleteHashtagPresetSchema = z.object({
  id: z.string().min(1, ERROR_ID_REQUIRED),
});

/**
 * Storage settings schemas
 */
export const uploadProviderSchema = z.enum([
  "S3",
  "BLOSSOM_PRIMAL",
  "BLOSSOM_BLOSSTR",
  "BLOSSOM_SFS",
  "BLOSSOM_CUSTOM",
]);

export const updateUploadProviderSchema = z
  .object({
    uploadProvider: uploadProviderSchema,
    customBlossomUrl: z
      .string()
      .optional()
      .transform((val) => {
        const trimmed = (val ?? "").trim();
        if (!trimmed) return null;
        return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
      }),
  })
  .superRefine((data, ctx) => {
    if (data.uploadProvider !== "BLOSSOM_CUSTOM") {
      return;
    }

    if (!data.customBlossomUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customBlossomUrl"],
        message: ERROR_CUSTOM_BLOSSOM_URL_REQUIRED,
      });
      return;
    }
    if (!data.customBlossomUrl.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customBlossomUrl"],
        message: ERROR_CUSTOM_BLOSSOM_URL_HTTPS,
      });
      return;
    }
    try {
      new URL(data.customBlossomUrl);
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customBlossomUrl"],
        message: ERROR_INVALID_URL_FORMAT,
      });
    }
  });

export const updateBlossomMirrorsSchema = z.object({
  enableMirrorBlossom: z
    .union([z.string(), z.boolean()])
    .optional()
    .transform(
      (val) => val === FORM_VALUE_ON || val === FORM_VALUE_TRUE || val === true
    ),
  mirrorUrls: z
    .string()
    .optional()
    .transform((val) =>
      val ? val.split("\n").filter((url) => url.trim()) : []
    )
    .pipe(
      z
        .array(
          z
            .string()
            .refine(
              (url) => url.startsWith("https://"),
              ERROR_MIRROR_URLS_HTTPS
            )
            .refine((url) => {
              try {
                new URL(url);
                return true;
              } catch {
                return false;
              }
            }, ERROR_INVALID_URL_FORMAT)
            .transform((url) => (url.endsWith("/") ? url.slice(0, -1) : url))
        )
        .min(0)
    ),
});

/**
 * Primary signer profile schema (account-level fallback profile).
 * Stores only non-secret metadata server-side.
 */
export const updatePrimarySignerProfileSchema = z
  .object({
    method: z.enum(["bunker_input", "nostrconnect_uri"]),
    label: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim() ?? "";
        return trimmed ? trimmed : null;
      }),
    expectedPubkey: z
      .string()
      .optional()
      .transform((value) => {
        const trimmed = value?.trim() ?? "";
        return trimmed ? trimmed : null;
      }),
    bunkerInput: z
      .string()
      .optional()
      .transform((value) => value?.trim() ?? ""),
    uri: z
      .string()
      .optional()
      .transform((value) => value?.trim() ?? ""),
    relays: z
      .string()
      .optional()
      .transform((value) =>
        (value ?? "")
          .split("\n")
          .map((relay) => relay.trim())
          .filter((relay) => relay.length > 0)
      ),
  })
  .superRefine((data, ctx) => {
    if (data.method === "bunker_input") {
      if (!data.bunkerInput) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bunkerInput"],
          message: ERROR_BUNKER_INPUT_REQUIRED,
        });
      }
      return;
    }

    if (!data.uri) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["uri"],
        message: ERROR_NOSTRCONNECT_URI_REQUIRED,
      });
    }
    if (data.relays.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["relays"],
        message: ERROR_PRIMARY_RELAYS_REQUIRED,
      });
    }
  });

/**
 * Queue type schemas
 */
export const scheduleTypeSchema = z.enum([
  "INTERVAL",
  "FIXED_SLOTS",
  "WEEKLY_SLOTS",
]);

const weeklySlotEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{1,2}:\d{2}$/, "Time must be HH:mm"),
});

export const createQueueTypeSchema = z
  .object({
    name: z.string().trim().min(1, ERROR_NAME_REQUIRED),
    scheduleType: scheduleTypeSchema,
    colorToken: z
      .enum([
        "slate",
        "blue",
        "cyan",
        "teal",
        "green",
        "lime",
        "amber",
        "orange",
        "red",
        "pink",
        "violet",
        "indigo",
      ])
      .default("slate"),
    description: z.string().optional(),
    hashTagPresetId: z
      .string()
      .nullable()
      .optional()
      .transform((val) => (val === "none" || !val ? null : val)),
    intervalHours: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : undefined))
      .pipe(z.number().positive().optional())
      .refine(
        (val) => val === undefined || isAllowedScheduleInterval(val),
        ERROR_SCHEDULE_INTERVAL_ALLOWED
      ),
    useGlobalInterval: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform(
        (val) =>
          val === FORM_VALUE_ON || val === FORM_VALUE_TRUE || val === true
      ),
    slots: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s)
          : undefined
      )
      .pipe(z.array(z.string()).optional()),
    weeklySlots: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return;
        try {
          const parsed = JSON.parse(val) as unknown;
          return Array.isArray(parsed) ? parsed : undefined;
        } catch {
          return;
        }
      })
      .pipe(z.array(weeklySlotEntrySchema).optional()),
    scheduleRandomWindowMinutes: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val === "" || val === undefined ? 0 : Number(val)))
      .pipe(z.number().int().min(0).max(15)),
    includeHashtagsInNoteBody: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform((val) => {
        if (val === undefined) return true;
        return val === FORM_VALUE_ON || val === FORM_VALUE_TRUE || val === true;
      }),
  })
  .refine(
    (data) => {
      if (data.scheduleType === "INTERVAL") {
        return (
          data.useGlobalInterval === true || data.intervalHours !== undefined
        );
      }
      return true;
    },
    {
      message:
        "Interval hours or use global interval is required for INTERVAL schedule type",
      path: ["intervalHours"],
    }
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
    }
  )
  .refine(
    (data) => {
      if (data.scheduleType === "WEEKLY_SLOTS") {
        return data.weeklySlots !== undefined && data.weeklySlots.length > 0;
      }
      return true;
    },
    {
      message:
        "At least one weekly slot (day + time) is required for WEEKLY_SLOTS schedule type",
      path: ["weeklySlots"],
    }
  );

export const updateQueueTypeSchema = z
  .object({
    id: z.string().min(1, ERROR_ID_REQUIRED),
    name: z.string().trim().min(1, ERROR_NAME_REQUIRED),
    scheduleType: scheduleTypeSchema,
    colorToken: z.enum([
      "slate",
      "blue",
      "cyan",
      "teal",
      "green",
      "lime",
      "amber",
      "orange",
      "red",
      "pink",
      "violet",
      "indigo",
    ]),
    description: z.string().optional(),
    isEnabled: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform(
        (val) =>
          val === FORM_VALUE_ON || val === FORM_VALUE_TRUE || val === true
      ),
    hashTagPresetId: z
      .string()
      .nullable()
      .optional()
      .transform((val) => (val === "none" || !val ? null : val)),
    intervalHours: z
      .string()
      .optional()
      .transform((val) => (val ? Number(val) : undefined))
      .pipe(z.number().positive().optional())
      .refine(
        (val) => val === undefined || isAllowedScheduleInterval(val),
        ERROR_SCHEDULE_INTERVAL_ALLOWED
      ),
    useGlobalInterval: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform(
        (val) =>
          val === FORM_VALUE_ON || val === FORM_VALUE_TRUE || val === true
      ),
    slots: z
      .string()
      .optional()
      .transform((val) =>
        val
          ? val
              .split(",")
              .map((s) => s.trim())
              .filter((s) => s)
          : undefined
      )
      .pipe(z.array(z.string()).optional()),
    weeklySlots: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return;
        try {
          const parsed = JSON.parse(val) as unknown;
          return Array.isArray(parsed) ? parsed : undefined;
        } catch {
          return;
        }
      })
      .pipe(z.array(weeklySlotEntrySchema).optional()),
    scheduleRandomWindowMinutes: z
      .union([z.string(), z.number()])
      .optional()
      .transform((val) => (val === "" || val === undefined ? 0 : Number(val)))
      .pipe(z.number().int().min(0).max(15)),
    includeHashtagsInNoteBody: z
      .union([z.string(), z.boolean()])
      .optional()
      .transform((val) => {
        if (val === undefined) return true;
        return val === FORM_VALUE_ON || val === FORM_VALUE_TRUE || val === true;
      }),
  })
  .refine(
    (data) => {
      if (data.scheduleType === "INTERVAL") {
        return (
          data.useGlobalInterval === true || data.intervalHours !== undefined
        );
      }
      return true;
    },
    {
      message:
        "Interval hours or use global interval is required for INTERVAL schedule type",
      path: ["intervalHours"],
    }
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
    }
  )
  .refine(
    (data) => {
      if (data.scheduleType === "WEEKLY_SLOTS") {
        return data.weeklySlots !== undefined && data.weeklySlots.length > 0;
      }
      return true;
    },
    {
      message:
        "At least one weekly slot (day + time) is required for WEEKLY_SLOTS schedule type",
      path: ["weeklySlots"],
    }
  );

export const deleteQueueTypeSchema = z.object({
  id: z.string().min(1, ERROR_ID_REQUIRED),
  deleteMode: z
    .enum(["queue_only", "queue_and_scheduled"])
    .optional()
    .default("queue_only"),
});

export const toggleQueueEnabledSchema = z.object({
  id: z.string().min(1, ERROR_ID_REQUIRED),
  isEnabled: z
    .union([z.string(), z.boolean()])
    .transform(
      (val) => val === FORM_VALUE_ON || val === FORM_VALUE_TRUE || val === true
    ),
});

export const queueStatusActionSchema = z.object({
  id: z.string().min(1, ERROR_ID_REQUIRED),
});

/**
 * Accounts action schemas
 */
export const searchAccountsSchema = z.object({
  q: z.string().optional().default(""),
});

export const childNpubSchema = z
  .string()
  .regex(
    /^[0-9a-fA-F]{64}$/,
    "Invalid hex pubkey format (must be 64 hex characters)"
  );

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
    .transform((val) => val === FORM_VALUE_TRUE)
    .pipe(z.boolean()),
});

export const toggleHideLowTrustSchema = z.object({
  hidePostsFromLowTrustUsers: z
    .string()
    .transform((val) => val === FORM_VALUE_TRUE)
    .pipe(z.boolean()),
});

export const updateDefaultZapAmountSchema = z.object({
  defaultZapAmountSats: z.coerce.number().int().min(1).max(1_000_000),
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
});

/**
 * Subscription action schemas
 */
export const switchToFreePlanSchema = z.object({
  planId: canonicalPlanIdSchema,
});

/** No body required; intent is cancel_at_period_end */
export const cancelAtPeriodEndSchema = z.object({});

/** Schedule downgrade to a plan at period end */
export const scheduleDowngradeSchema = z.object({
  planId: canonicalPlanIdSchema,
});

export const topUpSubscriptionSchema = z
  .object({
    targetPlanId: canonicalPlanIdSchema,
    paymentLane: z.enum(["lightning_one_time", "nwc_auto_renew"]),
    billingCadence: z.enum(["monthly", "yearly"]).optional().default("monthly"),
    accessDurationMonths: z
      .union([z.string(), z.number()])
      .transform((v) => Number(v))
      .pipe(z.number().int().positive()),
  })
  .superRefine((data, ctx) => {
    if (data.billingCadence === "yearly") {
      if (data.accessDurationMonths !== 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["accessDurationMonths"],
          message: "Yearly top-ups must be 12 months",
        });
      }
      return;
    }

    // monthly
    if (![1, 3, 6].includes(data.accessDurationMonths)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accessDurationMonths"],
        message: "Monthly top-ups must be 1, 3, or 6 months",
      });
    }
  });
