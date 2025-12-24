import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { getQueueTypes } from "~/models/user.server";
import { ValidationError } from "~/lib/errors";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";

// Returns effective hashtags for a queue type
// This will return the hashtag preset assigned to the queue type, or empty if none assigned
export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);

    let requestBody: { queueTypeName?: string; queueTypeId?: string };
    try {
      requestBody = await request.json();
    } catch (error) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { queueTypeName, queueTypeId } = requestBody;

    // If explicitly "unassigned", return empty hashtags (valid case)
    if (queueTypeName === "unassigned") {
      return json({ hashtags: "" });
    }

    // If no queue type specified at all, return validation error
    if (!queueTypeName && !queueTypeId) {
      throw new ValidationError("queueTypeName or queueTypeId is required", {
        receivedBody: requestBody,
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
    return createSuccessResponse({
      hashtags: (queueType.hashTagPreset as { tags: string | null })?.tags || "",
    });
  },
);
