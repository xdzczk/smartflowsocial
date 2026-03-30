import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getThreadGroupSegmentsForUser } from "~/features/posts/server";

/**
 * GET /api/posts/thread-group?groupId=&postId=
 * Returns ordered thread segments for the post detail modal (same user only).
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const groupId = url.searchParams.get("groupId");
    const postId = url.searchParams.get("postId");

    if (!groupId?.trim()) {
      return json({ error: "groupId is required" }, { status: 400 });
    }
    if (!postId?.trim()) {
      return json({ error: "postId is required" }, { status: 400 });
    }

    const result = await getThreadGroupSegmentsForUser(
      userId,
      groupId.trim(),
      postId.trim()
    );

    if (!result) {
      return json({ segments: [], currentIndex: -1, total: 0 });
    }

    return json({
      segments: result.segments,
      currentIndex: result.currentIndex,
      total: result.segments.length,
    });
  } catch (error) {
    if (error instanceof Response) return error;
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
}
