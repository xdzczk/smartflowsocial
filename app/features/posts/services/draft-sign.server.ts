/**
 * Draft signing service
 * Handles signing and scheduling logic for draft posts
 */

import type { NostrEvent as NostrEventType, SignedEvent, NostrEvent } from "~/features/nostr/types";
import type { UserData, PostData } from "~/features/posts/types";
import { logError } from "~/lib/error-logger.server";
import { signEventFn } from "~/lib/nostr";

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
}

/**
 * Get effective hashtags for a draft post
 */
async function getEffectiveHashtags(
  useHashtagPresets: boolean,
  selectedHashtags: string,
  selectedQueue: string,
  userId: string,
  user: UserData,
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
        const data = await response.json() as { hashtags?: string };
        return data.hashtags || "";
      } else {
        // Fallback to user's default hashtags
        // Note: hashTags property doesn't exist on UserData, using empty string as fallback
        return "";
      }
    } catch (error) {
      logError(error instanceof Error ? error : new Error(String(error)), {
        userId: user?.id,
        selectedQueue,
        message: "Error fetching effective hashtags",
      });
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
      return JSON.parse(fileUrl[0]) as string[];
    } catch (e) {
      logError(e instanceof Error ? e : new Error(String(e)), {
        fileUrl: fileUrl[0],
        message: "Error parsing fileUrl",
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
  userTimezone: string,
): number {
  let scheduledTime: number;

  if (userTimezone !== "UTC" && userTimezone !== "Etc/GMT") {
    const utcDate = new Date(scheduledFor);
    const userDate = new Date(scheduledFor).toLocaleString("en-US", {
      timeZone: userTimezone,
    });
    const userOffset =
      (new Date(userDate).getTime() - new Date(scheduledFor).getTime()) / 60000;
    utcDate.setMinutes(utcDate.getMinutes() - userOffset);
    scheduledTime = utcDate.getTime();
  } else {
    const dateObj = new Date(scheduledFor + "Z");
    scheduledTime = dateObj.getTime();
  }

  return Math.floor(scheduledTime / 1000);
}

/**
 * Sign and prepare draft for scheduling
 */
export async function signDraftForScheduling(
  params: SignDraftParams,
): Promise<{ signedEvent: SignedEvent; nostrEvent: NostrEventType; scheduledForUnix: number }> {
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
  } = params;

  const userTimezone = currentUser?.timezone ?? "UTC";
  const scheduledForUnix = calculateScheduledTime(scheduledFor, userTimezone);

  // Get effective hashtags
  const effectiveHashtags = await getEffectiveHashtags(
    useHashtagPresets,
    selectedHashtags,
    selectedQueue,
    currentUser?.id ?? "",
    user,
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

  const contentToSign = currentUser?.showHashTagsinPosts
    ? `${baseContent}\n${effectiveHashtags}`
    : baseContent;

  const { nostrEvent, signedEvent } = await signEventFn({
    content: contentToSign,
    created_at: scheduledForUnix,
    kind: 1,
    tags: tagArray,
  });

  return { signedEvent, nostrEvent, scheduledForUnix };
}

