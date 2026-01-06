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
});

/**
 * Union schema for all payment actions
 */
export const plansActionSchema = z.discriminatedUnion("intent", [
  checkPaymentStatusSchema,
  selectPlanSchema,
]);
