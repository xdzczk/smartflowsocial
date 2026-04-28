/**
 * Parent API service layer
 * Handles parent account information for child accounts
 */

import { json } from "@remix-run/node";

import {
  getCompleteProfile,
  LOGIN_FLOW_PRIMAL_FETCH_BUDGET_MS,
} from "~/features/auth/profile.server";
import type { ProfileData } from "~/features/nostr/types";
import {
  createUser,
  getUserBasicInfo,
  getUserByNpubWithProfile,
} from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { normalizeError } from "~/lib/errors";

function isDisplayProfileEmpty(nostrProfile: unknown): boolean {
  if (nostrProfile == null) return true;
  let p: Record<string, unknown> | null = null;
  if (typeof nostrProfile === "string") {
    try {
      p = JSON.parse(nostrProfile) as Record<string, unknown>;
    } catch {
      return true;
    }
  } else if (typeof nostrProfile === "object" && !Array.isArray(nostrProfile)) {
    p = nostrProfile as Record<string, unknown>;
  }
  if (!p) return true;
  const picture = p["picture"];
  const name = p["name"];
  const displayName = p["display_name"];
  return (
    (picture == null || String(picture).trim() === "") &&
    (name == null || String(name).trim() === "") &&
    (displayName == null || String(displayName).trim() === "")
  );
}
function extractProfileBits(nostrProfile: ProfileData | null | undefined) {
  if (!nostrProfile) {
    return {
      name: undefined,
      display_name: undefined,
      picture: undefined,
    } as const;
  }
  try {
    if (typeof nostrProfile === "string") {
      const pParsed: unknown = JSON.parse(nostrProfile);
      if (pParsed && typeof pParsed === "object" && !Array.isArray(pParsed)) {
        const p = pParsed as unknown as {
          name?: string;
          display_name?: string;
          picture?: string;
        };
        return {
          name: typeof p.name === "string" ? p.name : undefined,
          display_name:
            typeof p.display_name === "string" ? p.display_name : undefined,
          picture: typeof p.picture === "string" ? p.picture : undefined,
        } as const;
      }
    }
    if (typeof nostrProfile === "object" && !Array.isArray(nostrProfile)) {
      const p = nostrProfile as {
        name?: string;
        display_name?: string;
        picture?: string;
      };
      return {
        name: typeof p.name === "string" ? p.name : undefined,
        display_name:
          typeof p.display_name === "string" ? p.display_name : undefined,
        picture: typeof p.picture === "string" ? p.picture : undefined,
      } as const;
    }
  } catch {
    // Silently ignore parse errors - return defaults
  }
  return {
    name: undefined,
    display_name: undefined,
    picture: undefined,
  } as const;
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

  let profileForDisplay: ProfileData | null | undefined =
    parent.nostrProfile as ProfileData | null | undefined;

  if (isDisplayProfileEmpty(profileForDisplay)) {
    try {
      const { nostrProfile: fresh } = await getCompleteProfile({
        npub: parent.npub,
        primalFetchBudgetMs: LOGIN_FLOW_PRIMAL_FETCH_BUDGET_MS,
      });
      if (!isDisplayProfileEmpty(fresh)) {
        await createUser(parent.npub, JSON.stringify(fresh));
        profileForDisplay = fresh as ProfileData | null | undefined;
      }
    } catch (e) {
      logError(normalizeError(e), {
        message: "Failed to refresh parent nostr profile",
        npub: parent.npub,
      });
    }
  }

  const bits = extractProfileBits(profileForDisplay);

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
