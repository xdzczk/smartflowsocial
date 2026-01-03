import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  getEffectiveHashtags,
  parseEffectiveHashtagsRequest,
} from "~/features/posts";
import { withCSRFProtection } from "~/lib/csrf.server";
import { ValidationError } from "~/lib/errors";

// Returns effective hashtags for a queue type
// This will return the hashtag preset assigned to the queue type, or empty if none assigned
export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const userId = await requireUserId(request);

    let requestBody: unknown;
    try {
      const jsonResult: unknown = await request.json();
      requestBody = jsonResult;
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { queueTypeName, queueTypeId } =
      parseEffectiveHashtagsRequest(requestBody);

    return await getEffectiveHashtags(userId, queueTypeName, queueTypeId);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
});
