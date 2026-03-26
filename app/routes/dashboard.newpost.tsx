import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { NewPostPage } from "~/features/posts/composer";
import {
  handleNewPostAction,
  loadNewPostData,
} from "~/features/posts/server/composer";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    if (type === "article") {
      const target = new URL("/dashboard/newlongformpost", url.origin);
      target.searchParams.set("type", "article");
      const templateIdParam = url.searchParams.get("templateId");
      if (templateIdParam)
        target.searchParams.set("templateId", templateIdParam);
      const scheduledAtParam = url.searchParams.get("scheduledAt");
      if (scheduledAtParam)
        target.searchParams.set("scheduledAt", scheduledAtParam);
      return redirect(`${target.pathname}${target.search}`);
    }
    const draftId = url.searchParams.get("draftId");
    const templateId = url.searchParams.get("templateId");
    const data = await loadNewPostData(
      userId,
      draftId && draftId.length > 0 ? draftId : null,
      templateId && templateId.length > 0 ? templateId : null
    );
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
      relays: [],
      templates: [],
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
