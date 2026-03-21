import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireSession } from "~/features/auth";
import { publishSignedEventToRelays } from "~/features/nostr/server";
import type { SignedEvent } from "~/features/nostr/types";
import {
  KIND_VOTE,
  normalizeRelayUrls,
  parsePollFromSignedEvent,
  validateVoteAgainstPoll,
} from "~/features/polls";
import { recordReplyPost } from "~/features/posts/server";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { withCSRFProtection } from "~/lib/csrf";
import { ValidationError } from "~/lib/errors";
import { featureFlags } from "~/lib/feature-flags.server";
import { assertSignedEventMatchesSessionPubkey } from "~/lib/nostr-session-invariants.server";
import { validateSignedEventCryptographically } from "~/lib/validation/nostr-cryptographic.server";

type AssertFunction = (
  condition: boolean,
  message: string,
  context?: Record<string, unknown>
) => asserts condition;

const PUBLISH_API_ROUTE = "/api/publish";

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
          ? (bodyRaw as {
              relays?: unknown;
              event?: unknown;
              /** Required when `event.kind === 1018` (NIP-88 vote): signed kind 1068 poll. */
              pollEvent?: unknown;
              recordAsReply?: {
                replyToEventId: string;
                replyToPostId?: string | null;
              };
            })
          : {};
      const { relays, event, pollEvent: pollEventRaw, recordAsReply } = body;

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
        context: { route: PUBLISH_API_ROUTE },
      });

      let publishRelays = resolvedRelays;
      if (eventObj.kind === KIND_VOTE) {
        if (!featureFlags.nip88PollsEnabled) {
          throw new ValidationError("NIP-88 polls are disabled", {
            route: PUBLISH_API_ROUTE,
          });
        }
        assert(
          pollEventRaw !== null && pollEventRaw !== undefined,
          "pollEvent is required for kind 1018 (NIP-88 vote)",
          { hasPollEvent: pollEventRaw != null }
        );
        const validatedPoll =
          validateSignedEventCryptographically(pollEventRaw);
        const voteCheck = validateVoteAgainstPoll(eventObj, validatedPoll);
        if (!voteCheck.ok) {
          throw new ValidationError(voteCheck.error ?? "Invalid poll vote", {
            route: PUBLISH_API_ROUTE,
          });
        }
        const parsedPoll = parsePollFromSignedEvent(validatedPoll);
        if (!parsedPoll) {
          throw new ValidationError("Invalid poll event for vote publish", {
            route: PUBLISH_API_ROUTE,
          });
        }
        publishRelays = normalizeRelayUrls([
          ...resolvedRelays,
          ...parsedPoll.relayUrls,
        ]);
      }

      const publishResult = await publishSignedEventToRelays({
        signedEvent: eventObj,
        relays: publishRelays,
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

      // Optionally record reply as a Post (postKind REPLY) so it appears in Posted
      const isKind1Reply =
        eventObj.kind === 1 &&
        Array.isArray(eventObj.tags) &&
        eventObj.tags.some(
          (t) =>
            Array.isArray(t) &&
            t[0] === "e" &&
            (t[3] === "reply" || t[2] === "reply")
        );
      if (
        recordAsReply &&
        typeof recordAsReply === "object" &&
        typeof recordAsReply.replyToEventId === "string" &&
        recordAsReply.replyToEventId.length > 0 &&
        isKind1Reply
      ) {
        try {
          await recordReplyPost({
            userId: session.userId,
            signedEvent: eventObj,
            replyToEventId: recordAsReply.replyToEventId,
            replyToPostId: recordAsReply.replyToPostId,
          });
        } catch (replyCreateError) {
          const { logError } = await import("~/lib/error-logger.server");
          logError(
            replyCreateError instanceof Error
              ? replyCreateError
              : new Error(String(replyCreateError)),
            {
              userId: session.userId,
              eventId: eventObj.id,
              message: "API publish: Failed to create reply Post record",
            }
          );
          // Do not fail the request; the event was already published to relays
        }
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
