import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  TemplatesPage,
  handleTemplatesAction,
  loadTemplatesData,
} from "~/features/templates";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { templatesLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to templates feature
  await requireFeatureAccess(userId, "templates");

  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search") ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 100;

  const data = await loadTemplatesData(userId, searchTerm, page, limit);

  // Validate loader response with Zod schema
  return json(validateLoaderResponse(data, templatesLoaderDataSchema));
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleTemplatesAction(formData, userId);

      // Type narrowing: check if result is a Response
      if (result instanceof Response) {
        return result;
      }

      // Type narrowing: check if result has error property
      if (typeof result === "object" && "error" in result && result.error) {
        return json(result, { status: 400 });
      }

      return json(result);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default TemplatesPage;
