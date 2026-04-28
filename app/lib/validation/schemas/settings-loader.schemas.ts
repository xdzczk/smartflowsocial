/**
 * Zod schemas for settings loader data validation
 * Replaces unsafe type casts with runtime validation
 */

import { z } from "zod";

/**
 * Schema for subscription data
 */
export const subscriptionSchema = z
  .object({
    id: z.string(),
    planId: z.string().nullable(),
    status: z.string(),
    startDate: z.preprocess((val) => {
      if (val instanceof Date) return val;
      if (typeof val === "string") return new Date(val);
      return val;
    }, z.date()),
    currentPeriodEnd: z.preprocess((val) => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val;
      if (typeof val === "string") return new Date(val);
      return val;
    }, z.date().nullable()),
    nextPaymentDue: z.preprocess((val) => {
      if (val === null || val === undefined) return null;
      if (val instanceof Date) return val;
      if (typeof val === "string") return new Date(val);
      return val;
    }, z.date().nullable()),
    cancelAtPeriodEnd: z.boolean(),
    plan: z
      .object({
        id: z.string(),
        name: z.string(),
        price: z.number(),
        enableLifetimeAccess: z.boolean(),
      })
      .nullable()
      .optional()
      .transform((val) => val ?? null),
  })
  .nullable();

/**
 * Schema for available plan
 */
export const availablePlanSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  enableLifetimeAccess: z.preprocess((val) => val ?? false, z.boolean()),
});

/**
 * Schema for payment history item
 */
export const paymentHistoryItemSchema = z.object({
  id: z.string(),
  amount: z.number(),
  amountUsd: z.preprocess((val) => val ?? null, z.number().nullable()),
  description: z
    .string()
    .nullish()
    .transform((val) => val ?? null),
  paidAt: z.preprocess((val) => {
    if (val === null || val === undefined) return null;
    if (val instanceof Date) return val;
    if (typeof val === "string") return new Date(val);
    return val;
  }, z.date().nullable()),
  paymentMethod: z
    .string()
    .nullish()
    .transform((val) => val ?? null),
  paymentHash: z.string(),
  planName: z.string().optional(),
  planPrice: z.number().optional(),
});

/**
 * Schema for account child (confirmed or pending)
 */
export const accountChildSchema = z.object({
  npub: z.string(),
  nostrProfile: z.any().nullable().optional(), // ProfileData type - using any for flexibility
});

/**
 * Schema for accounts data
 */
export const accountsSchema = z
  .object({
    parentNpub: z.string().optional(),
    confirmedChildren: z.array(accountChildSchema).optional(),
    pendingChildren: z.array(accountChildSchema).optional(),
    pendingIncomingParents: z.array(accountChildSchema).optional(),
    isChild: z.boolean().optional(),
    parentUser: z
      .object({
        npub: z.string(),
        nostrProfile: z.any().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .nullable();
