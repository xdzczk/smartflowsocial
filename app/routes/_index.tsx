import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { validateEvent } from "nostr-tools";

import { getUser } from "~/features/auth";
import { HomePage } from "~/features/marketing";
import { withCSRFProtection } from "~/lib/csrf";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    // Use getUser instead of getUserId to ensure session is actually valid
    // This prevents showing user as logged in when session is invalid/expired
    const user = await getUser(request);
    return json({ user });
  } catch (error) {
    // If error is a Response (e.g., redirect from logout), return it directly
    if (error instanceof Response) {
      return error;
    }
    // If getUser throws (e.g., invalid legacy session), it will have already called logout
    // For landing page, errors are non-critical - just return empty data
    const { handleLoaderError } = await import("~/lib/error-handler.server");
    return handleLoaderError(error, {});
  }
};

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const formData = await request.formData();
      const event = formData.get("event");

      if (!event || typeof event !== "string") {
        const { ValidationError } = await import("~/lib/errors");
        throw new ValidationError("Missing or invalid event");
      }

      // Parse the event JSON
      let parsedEvent: {
        id?: string;
        pubkey?: string;
        sig?: string;
        [key: string]: unknown;
      };
      try {
        parsedEvent = JSON.parse(event) as typeof parsedEvent;
      } catch (parseError) {
        const { ValidationError } = await import("~/lib/errors");
        throw new ValidationError("Invalid event JSON format", {
          error:
            parseError instanceof Error
              ? parseError.message
              : String(parseError),
        });
      }

      // Verify the signature
      const isValid = validateEvent(parsedEvent);

      if (isValid) {
        // The signature is valid, so this is the real user
        // You can now create a session or token for the user
        return json({ success: true });
      }

      // The signature is not valid
      const { AuthenticationError } = await import("~/lib/errors");
      throw new AuthenticationError("Invalid signature or expired event", {
        hasEvent: !!event,
      });
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default HomePage;
