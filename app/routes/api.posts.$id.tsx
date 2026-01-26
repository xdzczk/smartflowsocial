import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getPostDataForModal } from "~/features/posts/server";

/**
 * API route to fetch a single post by ID
 * GET /api/posts/:id
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const postId = params["id"];

    if (!postId) {
      return json({ error: "Post ID is required" }, { status: 400 });
    }

    const result = await getPostDataForModal(postId, userId);

    if (!result) {
      return json({ error: "Post not found" }, { status: 404 });
    }

    return json(result);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}
