import { z } from "zod";

const rankingMetricSchema = z.enum([
  "REACTIONS",
  "ZAPS",
  "SATS_ZAPPED",
  "REPLIES",
  "REPOSTS",
]);
const prizeModeSchema = z.enum(["EQUAL", "RANKED"]);

export const createContestSchema = z
  .object({
    title: z.string().max(120).optional().nullable(),
    sourceNoteId: z.string().min(1),
    sourcePostId: z.string().optional().nullable(),
    rankingMetric: rankingMetricSchema,
    contestStartAt: z.string().optional().nullable(),
    contestEndAt: z.string(),
    prizeMode: prizeModeSchema,
    winnerCount: z.number().int().min(1).max(50),
    equalRewardSats: z.number().int().min(0).optional().nullable(),
    rankRewards: z
      .array(
        z.object({
          rank: z.number().int().min(1),
          sats: z.number().int().min(0),
        })
      )
      .optional()
      .nullable(),
    fairnessConfig: z
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
    if (data.prizeMode === "EQUAL" && (data.equalRewardSats ?? 0) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["equalRewardSats"],
        message: "Equal reward sats must be greater than 0",
      });
    }

    if (data.prizeMode === "RANKED") {
      const rankRewards = data.rankRewards ?? [];
      if (rankRewards.length < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rankRewards"],
          message: "At least one ranked reward is required",
        });
      }
    }
  });
