/**
 * Client-side Zod validation schemas for post action forms
 * These schemas are optimized for React Hook Form
 */

import { z } from "zod";

/**
 * Reschedule modal schema for client-side forms
 * Handles both regular posts and longform posts
 */
export const rescheduleModalClientSchema = z
  .object({
    scheduledFor: z.date({
      message: "Please select a date and time",
    }),
    queueTypeId: z.string().optional(),
  })
  .refine(
    (data) => {
      const now = new Date();
      return data.scheduledFor > now;
    },
    {
      message: "Cannot schedule posts in the past",
      path: ["scheduledFor"],
    }
  );

/**
 * Reschedule modal schema for longform posts (no queue type)
 */
export const rescheduleLongformModalClientSchema = z
  .object({
    scheduledFor: z.date({
      message: "Please select a date and time",
    }),
  })
  .refine(
    (data) => {
      const now = new Date();
      return data.scheduledFor > now;
    },
    {
      message: "Cannot schedule posts in the past",
      path: ["scheduledFor"],
    }
  );
