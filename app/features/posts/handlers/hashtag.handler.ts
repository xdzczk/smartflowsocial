/**
 * Hashtag Handler for Bulk Posts
 * 
 * Handles hashtag management and display based on queue type
 */

import type { QueueType } from "~/features/posts/types";
import { logClientError } from "~/lib/error-handler.client";

/**
 * Update displayed hashtags based on queue type
 */
export async function updateDisplayedHashtags(
  queueTypeName: string,
  queueTypes: QueueType[],
  tags: string[],
  setSelectedQueueType: (type: string) => void,
  setDisplayedHashtags: (hashtags: string | string[]) => void,
): Promise<void> {
  setSelectedQueueType(queueTypeName);

  if (queueTypeName === "unassigned") {
    setDisplayedHashtags(tags);
    return;
  }

  // Find the queue type object to get its ID
  const selectedQueueType = queueTypes.find(
    (qt) => (typeof qt === "string" ? qt : qt.name) === queueTypeName,
  );
  const queueTypeId =
    typeof selectedQueueType === "object" ? selectedQueueType.id : null;

  try {
    const response = await fetch("/api/effective-hashtags", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        queueTypeId,
        queueTypeName: queueTypeName, // Keep for backward compatibility
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as { hashtags?: string | string[] };
      setDisplayedHashtags(data.hashtags ?? tags);
    } else {
      setDisplayedHashtags(tags);
    }
  } catch (error) {
    logClientError(
      error instanceof Error ? error : new Error(String(error)),
      {
        component: "bulkposts",
        action: "updateDisplayedHashtags",
        queueTypeName,
      },
    );
    setDisplayedHashtags(tags);
  }
}



