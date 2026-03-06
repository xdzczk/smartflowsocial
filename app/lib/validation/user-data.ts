/**
 * Client-safe validation utilities for UserData from loader responses
 * This file can be imported in both server and client code
 */

import { userSchema } from "./schemas/loader-responses.schemas";

/**
 * UserData type for components (simplified from full User)
 */
export interface UserData {
  id: string;
  npub?: string;
  pubKey?: string;
  name?: string | null;
  picture?: string | null;
  timezone?: string | null;
  timeFormat?: "12h" | "24h" | null;
  dateFormat?: string | null;
  scheduleInterval?: number[];
  userRelays?: string[];
  showHashTagsinPosts?: boolean;
  isEnabled?: boolean;
}

/**
 * Safely validate and convert user object to UserData
 * Returns null if validation fails or user is null/undefined
 * Client-safe version (no server-only logging)
 */
export function validateUserData(value: unknown): UserData | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    const validated = userSchema.parse(value);

    // Convert to UserData format
    const userData: UserData = {
      id: validated.id,
      npub: validated.npub,
      pubKey: validated.npub, // npub is the public key
      timezone: validated.timezone ?? null,
      timeFormat: validated.timeFormat ?? null,
      dateFormat: validated.dateFormat ?? null,
      scheduleInterval: Array.isArray(validated.scheduleInterval)
        ? validated.scheduleInterval
            .map((item) => {
              if (typeof item === "string") {
                const parsed = parseInt(item, 10);
                return isNaN(parsed) ? undefined : parsed;
              }
              return typeof item === "number" ? item : undefined;
            })
            .filter((item): item is number => item !== undefined)
        : [],
      userRelays: validated.userRelays,
      isEnabled: validated.isEnabled,
    };

    return userData;
  } catch {
    // Client-safe version doesn't log errors
    return null;
  }
}
