/**
 * Client-side Zod validation schemas for search forms
 * These schemas are optimized for React Hook Form
 */

import { z } from "zod";

/**
 * Search form schema for client-side forms
 * Validates event ID input (hex, note1, or nevent1)
 */
export const searchFormClientSchema = z.object({
  eventInput: z
    .string()
    .min(1, "Please enter an event ID")
    .trim()
    .refine(
      (val) => {
        // Accept hex (64 chars), note1, or nevent1
        const isHex = /^[0-9a-fA-F]{64}$/.test(val);
        const isNote1 = val.startsWith("note1");
        const isNevent1 = val.startsWith("nevent1");
        return isHex || isNote1 || isNevent1;
      },
      {
        message:
          "Invalid format. Please enter a hex event ID (64 chars), note1, or nevent1",
      },
    ),
});


