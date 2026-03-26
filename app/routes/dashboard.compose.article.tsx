import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { NewLongFormPostPage } from "~/features/posts/longform";
import {
  handleNewLongFormAction,
  loadNewLongFormData,
} from "~/features/posts/server/longform";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const type = url.searchParams.get("type");
    if (type === "post" || type === "poll" || type === "thread") {
      return redirect(`/dashboard/compose?type=${encodeURIComponent(type)}`);
    }
    const templateId = url.searchParams.get("templateId");
    const data = await loadNewLongFormData(
      userId,
      templateId && templateId.length > 0 ? templateId : null
    );
    return json(data);
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {
      userId: "",
      tags: "",
      scheduleIntervals: [],
      queueTypes: [],
      hashTagPresets: [],
      userTimezone: "Etc/GMT",
      uploadProvider: null,
      templates: [],
      initialTemplateData: null,
    });
  }
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      return await handleNewLongFormAction(userId, request);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default NewLongFormPostPage;
