import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { useSearchParams } from "@remix-run/react";

import { requireUserId } from "~/features/auth";
import { NewPostPage } from "~/features/posts/composer";
import { NewLongFormPostPage } from "~/features/posts/longform";
import {
  handleNewPostAction,
  loadNewPostData,
} from "~/features/posts/server/composer";
import {
  handleNewLongFormAction,
  loadNewLongFormData,
} from "~/features/posts/server/longform";
import { withCSRFProtection } from "~/lib/csrf";

function isArticleType(type: string | null): boolean {
  return type === "article";
}

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    if (isArticleType(type)) {
      const templateId = url.searchParams.get("templateId");
      const data = await loadNewLongFormData(
        userId,
        templateId && templateId.length > 0 ? templateId : null
      );
      return json(data);
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
      const url = new URL(request.url);
      const type = url.searchParams.get("type");
      if (isArticleType(type)) {
        return await handleNewLongFormAction(userId, request);
      }
      return await handleNewPostAction(userId, request);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default function ComposePage() {
  const [searchParams] = useSearchParams();
  return isArticleType(searchParams.get("type")) ? (
    <NewLongFormPostPage />
  ) : (
    <NewPostPage />
  );
}
