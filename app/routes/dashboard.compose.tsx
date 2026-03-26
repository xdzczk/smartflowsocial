import {
  redirect,
  json,
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
      const articleUrl = new URL("/dashboard/compose/article", url.origin);
      for (const [key, value] of url.searchParams.entries()) {
        if (key !== "type") {
          articleUrl.searchParams.append(key, value);
        }
      }
      return redirect(`${articleUrl.pathname}${articleUrl.search}`);
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
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      scheduleIntervals: [],
      queueTypes: [],
      hashTagPresets: [],
      relays: [],
      templates: [],
      userId: "",
      tags: "",
      userTimezone: "Etc/GMT",
      uploadProvider: null,
      initialTemplateData: null,
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

export default function ComposePage() {
  return <NewPostPage />;
}
