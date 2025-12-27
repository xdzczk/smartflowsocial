/**
 * Nostr authentication service layer
 * Handles Nostr-based authentication flow
 */

import { validateEvent } from "nostr-tools";

import { getCompleteProfile } from "~/features/auth/profile.server";
import { createUserSession } from "~/features/auth/session.server";
import { AuthenticationError, ValidationError } from "~/lib/errors";
import { safeRedirect } from "~/lib/remix-utils";
import {
  createUser,
  getUserByNpub,
  updateUserProfile,
} from "~/models/user.server";

/**
 * Authenticate user via Nostr event signature
 */
export async function authenticateNostrUser(
  event: string,
  contentSign: string | null,
  redirectTo: string,
  request: Request,
) {
  if (!event || typeof event !== "string") {
    throw new ValidationError("Missing or invalid event");
  }

  // Parse the event JSON
  let parsedEvent: {
    id?: string;
    pubkey?: string;
    sig?: string;
    created_at?: number;
    kind?: number;
    content?: string;
    [key: string]: unknown;
  };
  try {
    parsedEvent = JSON.parse(event) as typeof parsedEvent;
  } catch (parseError) {
    throw new ValidationError("Invalid event JSON format", {
      error: parseError instanceof Error ? parseError.message : String(parseError),
    });
  }

  const safeRedirectTo = safeRedirect(redirectTo, `/dashboard`);

  // Verify the signature
  const isValid = validateEvent(parsedEvent);
  const createdAt = new Date((parsedEvent.created_at ?? 0) * 1000);
  const sixHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 6);

  if (
    isValid &&
    parsedEvent.content === contentSign &&
    createdAt >= sixHoursAgo &&
    parsedEvent.kind === 27235
  ) {
    // The signature is valid, so this is the real user
    // You can now create a session or token for the user
    let user = await getUserByNpub(parsedEvent.pubkey ?? "");
    const { nostrProfile } = await getCompleteProfile({
      npub: parsedEvent.pubkey ?? "",
    });

    if (!user) {
      user = await createUser(
        parsedEvent.pubkey ?? "",
        JSON.stringify(nostrProfile),
      );
    }
    
    const twelveHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 12);
    if (user.updatedAt < twelveHoursAgo) {
      await updateUserProfile({
        nostrProfile: JSON.stringify(nostrProfile),
        npub: parsedEvent.pubkey ?? "",
      });
    }
    
    return createUserSession({
      redirectTo: safeRedirectTo,
      remember: false,
      request,
      userId: user.id,
    });
  } else {
    // The signature is not valid
    throw new AuthenticationError("Invalid signature or expired event", {
      isValid,
      hasContentSign: !!contentSign,
      createdAt: parsedEvent.created_at,
      kind: parsedEvent.kind,
    });
  }
}

