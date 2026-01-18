import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  TemplateEditPage,
  loadTemplateEditData,
  handleTemplateEditAction,
} from "~/features/templates";
import { withCSRFProtection } from "~/lib/csrf";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const templateId = params["id"];

    if (!templateId) {
      const { ValidationError } = await import("~/lib/errors");
      throw new ValidationError("Template ID is required");
    }

    return loadTemplateEditData(templateId, userId);
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

export const action = withCSRFProtection(
  async ({ request, params }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const templateId = params["id"];

      if (!templateId) {
        const { ValidationError } = await import("~/lib/errors");
        throw new ValidationError("Template ID is required");
      }

      const formData = await request.formData();
      return handleTemplateEditAction(formData, templateId, userId);
    } catch (error) {
      // If error is a Response (e.g., redirect from requireUserId), return it
      if (error instanceof Response) {
        return error;
      }
      // Use dynamic import to avoid bundling issues
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default TemplateEditPage;
