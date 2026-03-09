/**
 * Handler for text post actions
 */

import { redirect } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

import {
  handlePostCreation,
  type PostHandlerContext,
  type PostAction,
} from "./base-handler.server";

const ERROR_INVALID_SIGNED_EVENT_FORMAT =
  "Invalid signedEvent or nostrEvent format";

/**
 * Parse and cryptographically validate signed event from form data
 */
function parseSignedEvent(formData: FormData): {
  signedEvent?: SignedEvent;
  nostrEvent?: NostrEvent;
} {
  const signedEventValue = formData.get("signedEvent");
  const nostrEventValue = formData.get("nostrEvent");

  if (!signedEventValue || !nostrEventValue) {
    return {};
  }

  const signedEventStr = String(signedEventValue);
  const nostrEventStr = String(nostrEventValue);

  try {
    const parsedSignedEvent = JSON.parse(signedEventStr) as unknown;
    const nostrEvent = JSON.parse(nostrEventStr) as NostrEvent;

    // Cryptographically validate the signed event
    // This verifies both structure (Zod) and signature (nostr-tools)
    const signedEvent = validateSignedEventCryptographically(parsedSignedEvent);

    return { signedEvent, nostrEvent };
  } catch (error) {
    // Re-throw ValidationError as-is, wrap others
    if (error instanceof Error && error.name === "ValidationError") {
      throw error;
    }
    throw new Error(ERROR_INVALID_SIGNED_EVENT_FORMAT);
  }
}

/**
 * Handle text post action (draft, post, or schedule)
 */
export async function handleTextPost(
  formData: FormData,
  context: PostHandlerContext,
  action: PostAction
): Promise<Response> {
  const contentValue = formData.get("content");
  const content = contentValue ? String(contentValue) : "";

  // Parse signed events if present (for post/schedule actions)
  const { signedEvent, nostrEvent } =
    action === "draft" ? {} : parseSignedEvent(formData);

  const result = await handlePostCreation(
    {
      content,
      fileUrls: [],
      postType: "TEXT",
      signedEvent,
      nostrEvent,
      scheduledFor:
        action === "schedule" && signedEvent
          ? signedEvent.created_at
          : undefined,
    },
    context,
    action
  );

  return redirect(result.redirect);
}
