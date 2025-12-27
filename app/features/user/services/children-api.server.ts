/**
 * Children API service layer
 * Handles children account information for parent accounts
 */

import { json } from "@remix-run/node";

import type { ProfileData } from "~/features/nostr/types";
import { logError } from "~/lib/error-logger.server";
import { normalizeError } from "~/lib/errors";
import { getUserSubscription } from "~/models/payment.server";
import { getConfirmedChildrenForParent, getUserBasicInfo } from "~/models/user.server";
function extractProfileBits(nostrProfile: ProfileData | null | undefined) {
  if (!nostrProfile) {
    return { name: undefined, display_name: undefined, picture: undefined } as const;
  }
  try {
    if (typeof nostrProfile === "string") {
      const p = JSON.parse(nostrProfile) as { name?: string; display_name?: string; picture?: string };
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
 * Load children information for a parent account
 * Only returns children if user has Premium or Founder plan
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

  // Check subscription plan is Premium or Founder
  const sub = await getUserSubscription(userId);
  const planId = (sub?.planId ?? "").toLowerCase();
  const planName = (sub?.Plan?.name ?? "").toLowerCase();
  const hasAccountsAccess = planId === "premium" || planName === "premium" || planName === "founder";
  
  if (!hasAccountsAccess) {
    return json({ children: [] });
  }

  const confirmed = await getConfirmedChildrenForParent(me.npub);
  const children = confirmed.map((c) => {
    const profile = c.nostrProfile && typeof c.nostrProfile === "object" && !Array.isArray(c.nostrProfile)
      ? (c.nostrProfile as ProfileData)
      : null;
    const bits = extractProfileBits(profile);
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



