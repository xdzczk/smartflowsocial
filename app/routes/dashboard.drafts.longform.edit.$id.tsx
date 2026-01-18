import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  handleLongFormEditAction,
  loadLongFormEditData,
} from "~/features/posts/server";
import { LongFormDraftEditPage } from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);
  const postId = params["id"];

  if (!postId) {
    throw new Response("Post not found", { status: 404 });
  }

  const data = await loadLongFormEditData(userId, postId);
  return json(data);
}

export const action = withCSRFProtection(
  async ({ request, params }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const postId = params["id"];

      if (!postId) {
        throw new Response("Post not found", { status: 404 });
      }

      return await handleLongFormEditAction(userId, postId, request);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default LongFormDraftEditPage;
