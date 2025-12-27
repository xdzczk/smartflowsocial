import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  getEffectiveHashtags,
  parseEffectiveHashtagsRequest,
} from "~/features/posts/services/effective-hashtags.server";
import {
  withActionErrorHandling,
} from "~/lib/error-handler.server";
import { ValidationError } from "~/lib/errors";

// Returns effective hashtags for a queue type
// This will return the hashtag preset assigned to the queue type, or empty if none assigned
export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    const userId = await requireUserId(request);

    let requestBody: unknown;
    try {
      requestBody = await request.json() as unknown;
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { queueTypeName, queueTypeId } = parseEffectiveHashtagsRequest(requestBody);

    return getEffectiveHashtags(userId, queueTypeName, queueTypeId);
  },
);
