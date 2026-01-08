/**
 * Zod schemas for Nostr event validation
 * Used to validate Prisma JsonValue before converting to typed objects
 */

import { z } from "zod";

/**
 * Schema for NostrEvent (unsigned event)
 */
export const nostrEventSchema = z.object({
  content: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
});

/**
 * Schema for SignedEvent (signed event with signature)
 */
export const signedEventSchema = z.object({
  id: z.string(),
  pubkey: z.string(),
  created_at: z.number(),
  kind: z.number(),
  tags: z.array(z.array(z.string())),
  content: z.string(),
  sig: z.string(),
});

/**
 * Type exports
 */
export type NostrEvent = z.infer<typeof nostrEventSchema>;
export type SignedEvent = z.infer<typeof signedEventSchema>;
