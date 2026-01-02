import type { ActionFunctionArgs } from "@remix-run/node";

import { authenticateNostrUser } from "~/features/auth";
import { safeRedirect } from "~/lib/remix-utils";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const event = formData.get("event") as string | null;
    const contentSign = formData.get("contentSign") as string | null;
    const redirectTo = safeRedirect(formData.get("redirectTo"), `/dashboard`);

    return authenticateNostrUser(event ?? "", contentSign, redirectTo, request);
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
