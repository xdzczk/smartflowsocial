import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { validateEvent } from "nostr-tools";

import { getUserId } from "~/features/auth";
import { HomePage } from "~/features/marketing";
import { withCSRFProtection } from "~/lib/csrf";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  if (userId) return json({});
  return json({});
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
