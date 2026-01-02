import type { LoaderFunctionArgs } from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { loadUploadProviderSettings } from "~/features/user";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    return loadUploadProviderSettings(userId);
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
