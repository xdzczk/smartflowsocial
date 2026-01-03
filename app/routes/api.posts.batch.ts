import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getBatchPosts, parseBatchPostsRequest } from "~/features/posts";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError } from "~/lib/errors";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>,
) => asserts condition;

export const action = withCSRFProtection(async ({ request }: ActionFunctionArgs) => {
  try {
    const errorHandler = await import("~/lib/error-handler.server");
    const assert: AssertFunction = errorHandler.assert;

    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const userId = await requireUserId(request);

    let body: unknown;
    try {
      body = (await request.json()) as unknown;
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { postIds } = parseBatchPostsRequest(body);

    return getBatchPosts(userId, postIds);
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
