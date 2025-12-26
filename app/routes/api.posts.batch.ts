import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import {
  getBatchPosts,
  parseBatchPostsRequest,
} from "~/features/posts/services/batch-posts.server";
import { ValidationError } from "~/lib/errors";
import {
  withActionErrorHandling,
  assert,
} from "~/lib/error-handler.server";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const userId = await requireUserId(request);

    let body: unknown;
    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { postIds } = parseBatchPostsRequest(body);

    return getBatchPosts(userId, postIds);
  },
);
