import { json, type ActionFunctionArgs } from "@remix-run/node";
import { validateEvent } from "nostr-tools";

import { getCompleteProfile } from "~/features/auth/profile.server";
import { createUserSession } from "~/features/auth/session.server";
import { safeRedirect } from "~/lib/remix-utils";
import {
  createUser,
  getUserByNpub,
  updateUserProfile,
} from "~/models/user.server";

interface NostrProfileType {
  website?: string;
  display_name?: string;
  picture?: string;
  nip05?: string;
  lud16?: string;
  banner?: string;
  lud06?: string;
  name?: string;
  about?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  zaps_count?: number;
  total_satszapped?: number;
  media?: {
    resources: Array<{ url?: string; [key: string]: unknown }>;
    event_id: string;
  };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();

    const event = formData.get("event");

    if (!event || typeof event !== "string") {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Missing or invalid event");
    }

    // Parse the event JSON
    let parsedEvent: { id?: string; pubkey?: string; sig?: string; [key: string]: unknown };
    try {
      parsedEvent = JSON.parse(event);
    } catch (parseError) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Invalid event JSON format", {
        error: parseError instanceof Error ? parseError.message : String(parseError),
      });
    }

    const redirectTo = safeRedirect(formData.get("redirectTo"), `/dashboard`);

    // Verify the signature
    const isValid = validateEvent(parsedEvent);
    const createdAt = new Date(parsedEvent.created_at * 1000);
    const sixHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 6);
    const contentSign = formData.get("contentSign");

    if (
      isValid &&
      parsedEvent.content === contentSign &&
      createdAt >= sixHoursAgo &&
      parsedEvent.kind === 27235
    ) {
      // The signature is valid, so this is the real user
      // You can now create a session or token for the user
      let user = await getUserByNpub(parsedEvent.pubkey);
      const { nostrProfile } = await getCompleteProfile({
        npub: parsedEvent.pubkey,
      });

      if (!user) {
        user = await createUser(
          parsedEvent.pubkey,
          nostrProfile as NostrProfileType,
        );
      }
      const twelveHoursAgo = new Date(Date.now() - 1000 * 60 * 60 * 12);
      if (user.updatedAt < twelveHoursAgo) {
        await updateUserProfile({
          nostrProfile: nostrProfile as NostrProfileType,
          npub: parsedEvent.pubkey,
        });
      }
      return createUserSession({
        redirectTo,
        remember: false,
        request,
        userId: user.id,
      });
    } else {
      // The signature is not valid
      const { AuthenticationError } = await import("~/lib/errors");
      throw new AuthenticationError("Invalid signature or expired event", {
        isValid,
        hasContentSign: !!contentSign,
        createdAt: parsedEvent.created_at,
        kind: parsedEvent.kind,
      });
    }
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}
