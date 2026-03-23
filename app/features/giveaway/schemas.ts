/**
 * Zod schemas for Giveaway create/update, scope, and preset.
 */

import { z } from "zod";

const engagementTypeSchema = z.enum(["REACTION", "REPOST", "COMMENT", "ZAP"]);

export const scopeReferencePeriodSchema = z.object({
  days: z.number().int().min(1).max(365).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const scopeReferenceSinglePostSchema = z.object({
  postId: z.string().min(1),
});

export const scopeReferenceQueueSchema = z.object({
  queueId: z.string().min(1),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const createGiveawaySchema = z
  .object({
    scopeType: z.enum([
      "PERIOD",
      "SINGLE_POST",
      "QUEUE",
      "FOLLOWERS",
      "FOLLOWING",
    ]),
    scopeReference: z.record(z.string(), z.unknown()),
    eligibilityFrom: z.string().optional().nullable(),
    eligibilityTo: z.string().optional().nullable(),
    engagementTypes: z.array(engagementTypeSchema),
    winnerCount: z.number().int().min(1).max(100),
    selectionMode: z.enum(["UNIQUE_USER", "WEIGHTED_BY_ENGAGEMENT"]).optional(),
    engagementWeights: z.record(z.string(), z.number()).optional().nullable(),
    filters: z
      .object({
        excludeMuted: z.boolean().optional(),
        excludeBlocked: z.boolean().optional(),
        excludeLowTrust: z.boolean().optional(),
        excludeNonFollowers: z.boolean().optional(),
        minAccountAgeDays: z.number().int().min(0).optional(),
        minFollowers: z.number().int().min(0).optional(),
      })
      .optional()
      .nullable(),
  })
  .superRefine((data, ctx) => {
    const followGraph =
      data.scopeType === "FOLLOWERS" || data.scopeType === "FOLLOWING";
    if (!followGraph && data.engagementTypes.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one engagement type required",
        path: ["engagementTypes"],
      });
    }
  });

export const winnerSnapshotSchema = z.array(
  z.object({
    pubkey: z.string(),
    npub: z.string(),
    qualifyingActions: z.array(
      z.object({
        kind: z.number(),
        eventId: z.string(),
        postId: z.string().optional(),
      })
    ),
  })
);

export const createGiveawayPresetSchema = z
  .object({
    name: z.string().min(1).max(100),
    scopeType: z.enum([
      "PERIOD",
      "SINGLE_POST",
      "QUEUE",
      "FOLLOWERS",
      "FOLLOWING",
    ]),
    scopeReference: z.record(z.string(), z.unknown()),
    engagementTypes: z.array(engagementTypeSchema),
    winnerCount: z.number().int().min(1).max(100),
    selectionMode: z.enum(["UNIQUE_USER", "WEIGHTED_BY_ENGAGEMENT"]).optional(),
    engagementWeights: z.record(z.string(), z.number()).optional().nullable(),
    filters: z.record(z.string(), z.unknown()).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const followGraph =
      data.scopeType === "FOLLOWERS" || data.scopeType === "FOLLOWING";
    if (!followGraph && data.engagementTypes.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one engagement type required",
        path: ["engagementTypes"],
      });
    }
  });
