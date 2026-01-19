import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { withCSRFProtection } from "~/lib/csrf";

export const action = withCSRFProtection(
  async ({ request: _request }: ActionFunctionArgs) => {
    try {
      // Deprecated legacy endpoint (client-generated challenge).
      // Use POST /auth/nostr/challenge + POST /auth/nostr/verify instead.
      return json(
        {
          success: false,
          error: {
            code: "DEPRECATED",
            message:
              "This endpoint is deprecated. Please sign in via /login (NIP-07 or NIP-46) using /auth/nostr/challenge and /auth/nostr/verify.",
          },
        },
        { status: 410 }
      );
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
