import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireSession } from "~/features/auth";
import { publishSignedEventToRelays } from "~/features/nostr/server";
import type { SignedEvent } from "~/features/nostr/types";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError } from "~/lib/errors";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const errorHandler = await import("~/lib/error-handler.server");
      const assert: AssertFunction = errorHandler.assert;

      // Validate HTTP method
      assert(request.method === "POST", "Method not allowed", {
        method: request.method,
      });

      // Parse and validate request body
      let bodyRaw: unknown;
      try {
        bodyRaw = await request.json();
      } catch (error) {
        throw new ValidationError("Invalid JSON in request body", {
          originalError: error instanceof Error ? error.message : String(error),
        });
      }

      const body =
        typeof bodyRaw === "object" && bodyRaw !== null
          ? (bodyRaw as { relays?: unknown; event?: unknown })
          : {};
      const { relays, event } = body;

      // Validate event presence (cryptographic validation happens in feature layer)
      assert(event !== null && event !== undefined, "Event is required", {
        hasEvent: event !== null && event !== undefined,
      });

      // Ensure user is authenticated (after basic request validation)
      const session = await requireSession(request);

      const relaysArray = Array.isArray(relays) ? relays : [];
      const sanitizedRelays = relaysArray
        .map((relay: unknown) =>
          (typeof relay === "string" ? relay : String(relay)).trim()
        )
        .filter((relay) => relay.length > 0);

      const eventObj = event as SignedEvent;
      assertSignedEventMatchesSessionPubkey({
        sessionPubkey: session.pubkey,
        eventPubkey: eventObj.pubkey,
        context: { route: "/api/publish" },
      });

      await publishSignedEventToRelays({
        signedEvent: eventObj,
        relays: sanitizedRelays,
      });

      return json({ success: true });
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
