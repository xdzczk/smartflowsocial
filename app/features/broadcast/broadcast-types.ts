import { BroadcastCampaignStatus } from "@prisma/client";
import { z } from "zod";

export const broadcastAudienceTypeSchema = z.enum([
  "CUSTOM",
  "FOLLOWERS",
  "MUTUALS",
]);

export const broadcastDeliveryModeSchema = z.enum([
  "BEST_COMPATIBILITY",
  "NIP17_ONLY",
  "NIP04_ONLY",
  "NIP17_FALLBACK_NIP04",
  "BOTH",
]);

export const broadcastSendStrategySchema = z.enum(["STANDARD", "STAGGERED"]);

export const createBroadcastDraftSchema = z
  .object({
    name: z.string().min(1).max(200),
    audienceType: broadcastAudienceTypeSchema,
    customNpubLines: z.array(z.string()).default([]),
    messageBody: z.string().min(1).max(8000),
    deliveryMode: broadcastDeliveryModeSchema.optional(),
    sendStrategy: broadcastSendStrategySchema.optional(),
    scheduledForIso: z.string().optional(),
    parseSnapshotJson: z.unknown().optional(),
    exclusionRulesJson: z.unknown().optional(),
  })
  .transform((d) => ({
    ...d,
    deliveryMode: d.deliveryMode ?? "BEST_COMPATIBILITY",
    sendStrategy: d.sendStrategy ?? "STANDARD",
  }));

export const finalizeRecipientPayloadSchema = z.object({
  recipientId: z.string(),
  signedEvent: z.record(z.string(), z.unknown()),
  giftWraps: z.array(z.record(z.string(), z.unknown())).optional(),
  publishRelays: z.array(z.string()).optional(),
});

export const finalizeBroadcastSchema = z.object({
  campaignId: z.string(),
  recipients: z.array(finalizeRecipientPayloadSchema).min(1).max(500),
});

export type CreateBroadcastDraftInput = z.infer<
  typeof createBroadcastDraftSchema
>;
export type FinalizeBroadcastInput = z.infer<typeof finalizeBroadcastSchema>;

export { BroadcastCampaignStatus };
