import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";

import { requireUserId } from "~/features/auth";
import { handleDraftEditAction } from "~/features/posts/server/drafts";
import { withCSRFProtection } from "~/lib/csrf";
export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUserId(request);
  const postId = params["id"]!;

  // Redirect to newpost composer with draft so short drafts open in UnifiedComposer
  return redirect(`/dashboard/newpost?draftId=${postId}`);
}

export const action = withCSRFProtection(
  async ({ request, params }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const postId = params["id"]!;
      const formData = await request.formData();
      const result = await handleDraftEditAction(formData, userId, postId);

      // Type narrowing: check if result is a Response
      if (result instanceof Response) {
        return result;
      }

      // Type narrowing: check if result has error property
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data */
      if (
        typeof result === "object" &&
        result !== null &&
        "error" in result &&
        result.error
      ) {
        /* eslint-enable @typescript-eslint/no-unnecessary-condition */
        return json(result, { status: 400 });
      }

      // Type narrowing: check if result has redirect property
      /* eslint-disable @typescript-eslint/no-unnecessary-condition -- Runtime type guard for Remix serialized data */
      if (
        typeof result === "object" &&
        result !== null &&
        "redirect" in result &&
        result.redirect
      ) {
        /* eslint-enable @typescript-eslint/no-unnecessary-condition */
        return redirect(result.redirect);
      }

      return json(result);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

/** Redirects in loader; this is only shown if client navigates without loader. */
export default function DraftEditRedirect() {
  return null;
}
