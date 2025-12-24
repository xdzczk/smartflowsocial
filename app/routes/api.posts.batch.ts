import type { ActionFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth/session.server";
import { getPostsByIds } from "~/models/post.server";
import { ValidationError, DatabaseError } from "~/lib/errors";
import {
  withActionErrorHandling,
  createSuccessResponse,
  assert,
} from "~/lib/error-handler.server";

export const action = withActionErrorHandling(
  async ({ request }: ActionFunctionArgs) => {
    assert(request.method === "POST", "Method not allowed", {
      method: request.method,
    });

    const userId = await requireUserId(request);

    let body: { postIds?: unknown };
    try {
      body = await request.json();
    } catch (error) {
      throw new ValidationError("Invalid JSON in request body", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    const { postIds } = body;

    assert(
      Array.isArray(postIds),
      "postIds must be an array",
      { postIdsType: typeof postIds, isArray: Array.isArray(postIds) },
    );

    let posts;
    try {
      posts = await getPostsByIds({ ids: postIds as string[], userId });
    } catch (error) {
      throw new DatabaseError("Failed to fetch posts", {
        userId,
        postIdsCount: (postIds as string[]).length,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }

    return createSuccessResponse(posts);
  },
);
