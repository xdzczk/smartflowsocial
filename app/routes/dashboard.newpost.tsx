import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { handleNewPostAction, loadNewPostData } from "~/features/posts/server";
import { NewPostPage } from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const data = await loadNewPostData(userId);
    return json(data);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId or requireAnySubscription), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    // Provide default data structure matching what the component expects
    return handleLoaderError(error, {
      scheduleIntervals: [],
      queueTypes: [],
      hashTagPresets: [],
      assets: [],
      relays: [],
    });
  }
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      return await handleNewPostAction(userId, request);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default NewPostPage;
