/**
 * Effective hashtags service layer
 * Handles effective hashtag calculation for queue types
 */

import { json } from "@remix-run/node";
import { getQueueTypes } from "~/models/user.server";
import { ValidationError } from "~/lib/errors";

/**
 * Get effective hashtags for a queue type
 * Returns the hashtag preset assigned to the queue type, or empty if none assigned
 */
export async function getEffectiveHashtags(
  userId: string,
  queueTypeName?: string,
  queueTypeId?: string,
) {
  // If explicitly "unassigned", return empty hashtags (valid case)
  if (queueTypeName === "unassigned") {
    return json({ hashtags: "" });
  }

  // If no queue type specified at all, return validation error
  if (!queueTypeName && !queueTypeId) {
    throw new ValidationError("queueTypeName or queueTypeId is required", {
      queueTypeName,
      queueTypeId,
    });
  }

  // Get all queue types for the user
  const queueTypes = await getQueueTypes(userId);

  // Find the specified queue type - prefer ID over name
  let queueType;
  if (queueTypeId) {
    queueType = queueTypes.find((qt) => qt.id === queueTypeId);
  } else {
    queueType = queueTypes.find((qt) => qt.name === queueTypeName);
  }

  if (!queueType || !("hashTagPreset" in queueType) || !queueType.hashTagPreset) {
    return json({ hashtags: "" });
  }

  // Return the hashtag preset tags assigned to this queue type
  // Use consistent unwrapped format to match other return statements
  return json({
    hashtags: (queueType.hashTagPreset as { tags: string | null })?.tags || "",
  });
}

/**
 * Parse effective hashtags request body
 */
export function parseEffectiveHashtagsRequest(body: unknown): {
  queueTypeName?: string;
  queueTypeId?: string;
} {
  if (typeof body !== "object" || body === null) {
    throw new ValidationError("Request body must be an object", {
      bodyType: typeof body,
    });
  }

  const requestBody = body as { queueTypeName?: string; queueTypeId?: string };

  return {
    queueTypeName: requestBody.queueTypeName,
    queueTypeId: requestBody.queueTypeId,
  };
}

