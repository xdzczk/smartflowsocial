/**
 * Zod validation schemas for payment action handlers
 */

import { z } from "zod";

/**
 * Check payment status schema
 */
export const checkPaymentStatusSchema = z.object({
  intent: z.literal("check_payment"),
  paymentId: z.string().min(1, "Payment ID is required"),
});

/**
 * Select plan schema
 */
export const selectPlanSchema = z.object({
  intent: z.literal("select_plan"),
  planId: z.string().min(1, "Plan ID is required"),
  paymentMode: z.enum(["manual", "auto_renew"]).optional().default("manual"),
  billingCadence: z.enum(["monthly", "yearly"]).optional().default("monthly"),
  accessDurationMonths: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined ? undefined : Number(v)))
    .pipe(z.number().int().positive().optional()),
  nwcString: z
    .string()
    .optional()
    .transform((val) => (typeof val === "string" ? val.trim() : val)),
});

/**
 * Union schema for all payment actions
 */
export const plansActionSchema = z.discriminatedUnion("intent", [
  checkPaymentStatusSchema,
  selectPlanSchema,
]);
