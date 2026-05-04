/**
 * Draft signing service  -  runs in the BROWSER.
 *
 * Despite living in `services/` (which is conventionally server code in
 * this repo), this module signs drafts using the user's connected
 * Nostr signer (NIP-07 / NIP-46), which is fundamentally a client
 * operation: the private key only exists in the user's browser /
 * remote signer app. Renamed to `.client.ts` so the file extension
 * matches its actual runtime, and so Remix's bundler correctly keeps
 * it out of the server bundle.
 *
 * Called from `useDraftEditState.handleSignAndResume` inside a
 * `startRecoverableSign` boundary  -  that is the durable signing
 * surface for the "resume scheduled draft" flow.
 */

import type {
  NostrEvent as NostrEventType,
  SignedEvent,
} from "~/features/nostr/types";
import type { UserData, PostData } from "~/features/posts/types";
import { logClientError } from "~/lib/error-handler.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";
import { applyRandomScheduleWindow } from "~/lib/schedule-random";
import {
  fromDate,
  fromISOString,
  parseDateTimeLocal,
  toUnixTimestamp,
} from "~/lib/temporal";

interface SignDraftParams {
  content: string;
  caption: string;
  scheduledFor: string;
  selectedQueue: string;
  useHashtagPresets: boolean;
  selectedHashtags: string;
  user: UserData;
  currentUser: UserData | null;
  post: PostData;
  /** Post at a random time within ±N minutes (0 = off). When > 0, nominal time is returned for queue "next slot". */
  scheduleRandomWindowMinutes?: number;
  /** When true (default), append hashtag line to signed note content. */
  includeHashtagsInNoteBody?: boolean;
}

/**
 * Get effective hashtags for a draft post
 */
async function getEffectiveHashtags(
  useHashtagPresets: boolean,
  selectedHashtags: string,
  selectedQueue: string,
  userId: string,
  user: UserData
): Promise<string> {
  if (useHashtagPresets) {
    // Manual hashtag presets are enabled
    if (selectedHashtags) {
      // Use manually selected hashtag preset
      return selectedHashtags;
    }
    // If useHashtagPresets is true but no manual preset selected, use no hashtags
    return "";
  } else {
    // Manual hashtag presets are disabled, use queue type's default hashtags
    try {
      const response = await fetch("/api/effective-hashtags", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId,
          queueTypeName: selectedQueue,
        }),
      });

      if (response.ok) {
        const dataRaw: unknown = await response.json();
        const data =
          dataRaw && typeof dataRaw === "object" && !Array.isArray(dataRaw)
            ? (dataRaw as { hashtags?: unknown })
            : {};
        const hashtags =
          typeof data.hashtags === "string" ? data.hashtags : null;
        return hashtags ?? "";
      } else {
        // Fallback to user's default hashtags
        // Note: hashTags property doesn't exist on UserData, using empty string as fallback
        return "";
      }
    } catch (error) {
      logClientError(
        error instanceof Error ? error : new Error(String(error)),
        {
          component: "draft-sign",
          action: "getEffectiveHashtags",
          userId: user.id,
          selectedQueue,
        }
      );
      // Fallback to user's default hashtags
      // Note: hashTags property doesn't exist on UserData, using empty string as fallback
      return "";
    }
  }
}

/**
 * Get image URLs from post fileUrl
 */
function getImageUrls(fileUrl: string[] | null | undefined): string[] {
  if (!fileUrl || fileUrl.length === 0) return [];

  // Handle case where fileUrl is an array of JSON strings
  if (typeof fileUrl[0] === "string" && fileUrl[0].startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(fileUrl[0]);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
    } catch (e) {
      logClientError(e instanceof Error ? e : new Error(String(e)), {
        component: "draft-sign",
        action: "getImageUrls",
        fileUrl: fileUrl[0],
      });
      return [];
    }
  }

  // Handle direct URLs
  return fileUrl;
}

/**
 * Calculate scheduled time in Unix timestamp
 */
function calculateScheduledTime(
  scheduledFor: string,
  userTimezone: string
): number {
  let scheduledTime: number;

  // Use Temporal for timezone conversion
  try {
    const zonedDateTime = parseDateTimeLocal(scheduledFor, userTimezone);
    const utcZoned = zonedDateTime.withTimeZone("UTC");
    scheduledTime = toUnixTimestamp(utcZoned) * 1000;
  } catch {
    // Fallback - still use Temporal for 100% consistency
    try {
      const zoned = fromISOString(scheduledFor + "Z", "UTC");
      scheduledTime = toUnixTimestamp(zoned) * 1000;
    } catch {
      // Fallback - try with Date conversion
      try {
        const dateObj = new Date(scheduledFor + "Z");
        const zoned = fromDate(dateObj, "UTC");
        scheduledTime = toUnixTimestamp(zoned) * 1000;
      } catch {
        // Ultimate fallback
        const dateObj = new Date(scheduledFor + "Z");
        scheduledTime = dateObj.getTime();
      }
    }
  }

  return Math.floor(scheduledTime / 1000);
}

/**
 * Sign and prepare draft for scheduling.
 * When scheduleRandomWindowMinutes > 0, actual publish time is random within ±window; nominal is returned for queue "next slot".
 */
export async function signDraftForScheduling(params: SignDraftParams): Promise<{
  signedEvent: SignedEvent;
  nostrEvent: NostrEventType;
  scheduledForUnix: number;
  /** When random window was used, the user-chosen time (Unix seconds) for queue logic. */
  nominalScheduledForUnix?: number;
}> {
  const {
    content,
    caption,
    scheduledFor,
    selectedQueue,
    useHashtagPresets,
    selectedHashtags,
    user,
    currentUser,
    post,
    scheduleRandomWindowMinutes = 0,
  } = params;

  const userTimezone =
    currentUser &&
    typeof currentUser === "object" &&
    "timezone" in currentUser &&
    typeof currentUser.timezone === "string"
      ? currentUser.timezone
      : "UTC";
  const nominalScheduledForUnix = calculateScheduledTime(
    scheduledFor,
    userTimezone
  );
  const scheduledForUnix =
    scheduleRandomWindowMinutes > 0
      ? applyRandomScheduleWindow(
          nominalScheduledForUnix,
          scheduleRandomWindowMinutes
        )
      : nominalScheduledForUnix;

  // Get effective hashtags
  const effectiveHashtags = await getEffectiveHashtags(
    useHashtagPresets,
    selectedHashtags,
    selectedQueue,
    currentUser?.id ?? "",
    user
  );

  const tagArray = effectiveHashtags
    .split(" ")
    .filter((tag) => tag.length > 0)
    .map((tag) => ["t", tag.replace("#", "")]);

  // Include image URLs in the content to sign (caption first, then image URLs)
  const imageUrls = getImageUrls(post.fileUrl);
  const imageUrlsText = imageUrls.length > 0 ? imageUrls.join(" ") : "";

  let baseContent = content || caption;
  if (imageUrlsText) {
    baseContent = baseContent
      ? `${baseContent} ${imageUrlsText}`
      : imageUrlsText;
  }

  const appendTags = params.includeHashtagsInNoteBody !== false;
  const contentToSign = appendTags
    ? `${baseContent}\n${effectiveHashtags}`
    : baseContent;

  const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
    {
      content: contentToSign,
      created_at: scheduledForUnix,
      kind: 1,
      tags: tagArray,
    },
    { clearCacheOnError: false }
  );

  return {
    signedEvent,
    nostrEvent,
    scheduledForUnix,
    ...(scheduleRandomWindowMinutes > 0 ? { nominalScheduledForUnix } : {}),
  };
}
