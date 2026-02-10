import {
  json,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  handleNewLongFormAction,
  loadNewLongFormData,
} from "~/features/posts/server";
import { NewLongFormPostPage } from "~/features/posts/ui";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const url = new URL(request.url);
    const templateId = url.searchParams.get("templateId");
    const data = await loadNewLongFormData(
      userId,
      templateId && templateId.length > 0 ? templateId : null
    );
    return json(data);
  } catch (error) {
    // If error is a Response (e.g., redirect from requireUserId or requireFeatureAccess), return it
    if (error instanceof Response) {
      return error;
    }
    // Use dynamic import to avoid bundling issues
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    // Provide default data structure matching what the component expects
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
