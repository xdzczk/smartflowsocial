/**
 * Parent API service layer
 * Handles parent account information for child accounts
 */

import { json } from "@remix-run/node";

import type { ProfileData } from "~/features/nostr/types";
import { logError } from "~/lib/error-logger.server";
import { normalizeError } from "~/lib/errors";
import { getUserBasicInfo, getUserByNpubWithProfile } from "~/models/user.server";

function extractProfileBits(nostrProfile: ProfileData | null | undefined) {
  if (!nostrProfile) {
    return { name: undefined, display_name: undefined, picture: undefined } as const;
  }
  try {
    if (typeof nostrProfile === "string") {
      const p = JSON.parse(nostrProfile);
      return { name: p?.name, display_name: p?.display_name, picture: p?.picture } as const;
    }
    if (typeof nostrProfile === "object") {
      const p = nostrProfile;
      return { name: p?.name, display_name: p?.display_name, picture: p?.picture } as const;
    }
  } catch {
    // Silently ignore parse errors - return defaults
  }
  return { name: undefined, display_name: undefined, picture: undefined } as const;
}

/**
 * Load parent information for a child account
 */
export async function loadParentData(userId: string) {
  const me = await getUserBasicInfo(userId);
  
  if (!me?.isChild || !me.parentNpub) {
    return json({ parent: null });
  }

  const parent = await getUserByNpubWithProfile(me.parentNpub);
  
  if (!parent) {
    return json({ parent: null });
  }

  const bits = extractProfileBits(parent.nostrProfile);
  
  return json({
    parent: {
      npub: parent.npub,
      name: bits.name,
      displayName: bits.display_name,
      picture: bits.picture,
    },
  });
}

/**
 * Handle errors for parent API
 */
export function handleParentApiError(error: unknown, requestUrl: string) {
  // If error is a Response (e.g., redirect from requireUserId), rethrow it
  if (error instanceof Response) {
    throw error;
  }
  
  // Gracefully handle other errors by returning null parent
  // Log error but don't expose it to client
  logError(normalizeError(error), { path: requestUrl });
  return json({ parent: null });
}

