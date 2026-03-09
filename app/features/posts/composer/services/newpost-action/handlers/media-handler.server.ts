/**
 * Handler for image/media post actions
 */

import { redirect } from "@remix-run/node";

import type { SignedEvent, NostrEvent } from "~/features/nostr/types";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

import { isVideoFile } from "../media-utils.server";

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
 * Extract file URLs from form data
 * Handles both single fileUrl field and multiple files field
 */
function extractFileUrls(formData: FormData): string[] {
  // Try single fileUrl field first (for backward compatibility)
  const fileUrlValue = formData.get("fileUrl");
  if (fileUrlValue) {
    try {
      const parsed = JSON.parse(String(fileUrlValue)) as string[];
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // If parsing fails, treat as single URL
      return [String(fileUrlValue)];
    }
  }

  // Try multiple files field
  const files = formData.getAll("files");
  return files
    .map((file) => {
      if (typeof file === "string") {
        return file;
      }
      if (file instanceof File) {
        return file.name;
      }
      return String(file);
    })
    .filter((url): url is string => url.length > 0);
}

/**
 * Determine post type from file URLs
 */
function determinePostType(fileUrls: string[]): "IMAGE" | "CAROUSEL" | "VIDEO" {
  if (fileUrls.length === 0) {
    return "IMAGE"; // Default
  }

  const hasVideo = fileUrls.some((url) => isVideoFile(url));
  if (hasVideo) {
    return "VIDEO";
  }

  return fileUrls.length > 1 ? "CAROUSEL" : "IMAGE";
}

/**
 * Handle media post action (draft, post, or schedule)
 */
export async function handleMediaPost(
  formData: FormData,
  context: PostHandlerContext,
  action: PostAction
): Promise<Response> {
  const captionValue = formData.get("caption");
  const caption = captionValue ? String(captionValue) : "";

  const fileUrls = extractFileUrls(formData);
  const postType = determinePostType(fileUrls);

  // Parse signed events if present (for post/schedule actions)
  const { signedEvent, nostrEvent } =
    action === "draft" ? {} : parseSignedEvent(formData);

  const result = await handlePostCreation(
    {
      content: caption,
      fileUrls,
      postType,
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
