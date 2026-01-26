import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { getPostDataForModal } from "~/features/posts/server";
import { getPublishRelayAcksByAttemptId } from "~/features/relays/publish-relay-acks.server";

/**
 * API route for polling relay acknowledgements
 * GET /api/publish-result?postId=xxx&publishAttemptId=xxx
 */
export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const postId = url.searchParams.get("postId");
    const publishAttemptId = url.searchParams.get("publishAttemptId");

    if (!postId || !publishAttemptId) {
      return json(
        { error: "postId and publishAttemptId are required" },
        { status: 400 }
      );
    }

    // Verify user owns the post (check both regular posts and longform posts)
    const postData = await getPostDataForModal(postId, userId);

    if (!postData) {
      return json({ error: "Post not found or unauthorized" }, { status: 404 });
    }

    // Get relay acknowledgements
    const acks = await getPublishRelayAcksByAttemptId(publishAttemptId, userId);

    return json({
      acks: acks.map((ack) => ({
        relayUrl: ack.relayUrl,
        status: ack.status,
        receivedAt: ack.receivedAt?.toISOString() ?? null,
        createdAt: ack.createdAt.toISOString(),
      })),
    });
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
