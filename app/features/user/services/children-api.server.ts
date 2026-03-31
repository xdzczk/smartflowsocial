/**
 * Children API service layer
 * Handles children account information for parent accounts
 */

import { json } from "@remix-run/node";

import { getCompleteProfile } from "~/features/auth/profile.server";
import type { ProfileData } from "~/features/nostr/types";
import { getUserSubscription } from "~/features/payments/data";
import {
  createUser,
  getConfirmedChildrenForParent,
  getUserBasicInfo,
} from "~/features/user";
import { logError } from "~/lib/error-logger.server";
import { normalizeError } from "~/lib/errors";
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
      const p = JSON.parse(nostrProfile) as {
        name?: string;
        display_name?: string;
        picture?: string;
      };
      return {
        name: p.name,
        display_name: p.display_name,
        picture: p.picture,
      } as const;
    }
    if (typeof nostrProfile === "object") {
      const p = nostrProfile;
      return {
        name: p.name,
        display_name: p.display_name,
        picture: p.picture,
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

/**
 * Load children information for a parent account
 * Only returns children if user has Pro or Founder plan
 */
export async function loadChildrenData(userId: string) {
  // Fetch minimal user info
  const me = await getUserBasicInfo(userId);

  if (!me?.npub) {
    return json({ children: [] });
  }

  // Only parents can fetch children
  if (me.isChild) {
    return json({ children: [] });
  }

  // Check subscription plan is Pro or Founder
  const sub = await getUserSubscription(userId);
  const planId = (sub?.planId ?? "").toLowerCase();
  const planName = (sub?.Plan?.name ?? "").toLowerCase();
  const hasAccountsAccess =
    planId === "premium" || planName === "premium" || planName === "founder";

  if (!hasAccountsAccess) {
    return json({ children: [] });
  }

  const confirmed = await getConfirmedChildrenForParent(me.npub);

  // Profile fields (name/picture) are user-controlled on Nostr and can change at any time.
  // Fetch the latest kind-0 metadata for children so account switcher stays current.
  // (Children list is small; this is worth the correctness and avoids "stuck" stale profiles.)
  const refreshedProfiles = await Promise.all(
    confirmed.map(async (c) => {
      try {
        const { nostrProfile } = await getCompleteProfile({ npub: c.npub });
        if (!isDisplayProfileEmpty(nostrProfile)) {
          await createUser(c.npub, JSON.stringify(nostrProfile));
          return { npub: c.npub, nostrProfile };
        }
      } catch (e) {
        logError(normalizeError(e), {
          message: "Failed to refresh child nostr profile",
          npub: c.npub,
        });
      }
      return { npub: c.npub, nostrProfile: c.nostrProfile };
    })
  );

  const refreshedByNpub = new Map(
    refreshedProfiles.map((p) => [p.npub, p.nostrProfile] as const)
  );

  const children = confirmed.map((c) => {
    const profile = refreshedByNpub.get(c.npub);
    const bits = extractProfileBits(profile as ProfileData | null | undefined);
    return {
      npub: c.npub,
      name: bits.name,
      displayName: bits.display_name,
      picture: bits.picture,
    };
  });

  return json({ children });
}

/**
 * Handle errors for children API
 */
export function handleChildrenApiError(error: unknown, requestUrl: string) {
  // If error is a Response (e.g., redirect from requireUserId), rethrow it
  if (error instanceof Response) {
    throw error;
  }

  // Gracefully handle other errors by returning empty array
  // Log error but don't expose it to client
  logError(normalizeError(error), { path: requestUrl });
  return json({ children: [] });
}
