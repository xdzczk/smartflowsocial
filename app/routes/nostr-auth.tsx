import type { ActionFunctionArgs } from "@remix-run/node";

import { authenticateNostrUser } from "~/features/auth";
import { withActionErrorHandling } from "~/lib/error-handler.server";
import { safeRedirect } from "~/lib/remix-utils";

export const action = withActionErrorHandling(async ({ request }: ActionFunctionArgs) => {
  const formData = await request.formData();
  const event = formData.get("event") as string | null;
  const contentSign = formData.get("contentSign") as string | null;
  const redirectTo = safeRedirect(formData.get("redirectTo"), `/dashboard`);

  return authenticateNostrUser(event || "", contentSign, redirectTo, request);
});
