import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireSession } from "~/features/auth";
import { publishSignedEventToRelays } from "~/features/nostr/server";
import type { SignedEvent } from "~/features/nostr/types";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
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

      // Client-provided relays are ignored by default.
      // The server derives the effective relays authoritatively (including managed relays).
      void relays;
      const resolvedRelays = await resolveExecutionRelays(session.userId);

      const eventObj = event as SignedEvent;
      assertSignedEventMatchesSessionPubkey({
        sessionPubkey: session.pubkey,
        eventPubkey: eventObj.pubkey,
        context: { route: "/api/publish" },
      });

      const publishResult = await publishSignedEventToRelays({
        signedEvent: eventObj,
        relays: resolvedRelays,
      });

      // Persist per-relay outcomes for observability (best-effort).
      // For non-post publishes (likes/replies/reposts), we key to a synthetic publishAttemptId.
      try {
        await persistPublishRelayAcks({
          publishAttemptId: `api:${eventObj.id}`,
          userId: session.userId,
          eventId: eventObj.id,
          results: publishResult.results,
        });
      } catch (ackError) {
        const { logError } = await import("~/lib/error-logger.server");
        logError(
          ackError instanceof Error ? ackError : new Error(String(ackError)),
          {
            userId: session.userId,
            eventId: eventObj.id,
            publishAttemptId: `api:${eventObj.id}`,
            message: "API publish: Failed to persist publish ACKs",
          }
        );
      }

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
