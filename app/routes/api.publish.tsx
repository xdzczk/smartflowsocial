import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";

import { requireSession } from "~/features/auth";
import { assertValidKind10002RelayListEvent } from "~/features/nostr/kind10002-nip65.server";
import { KIND_RELAY_LIST_NIP65 } from "~/features/nostr/nostr-event-kinds";
import { publishSignedEventToRelays } from "~/features/nostr/server";
import {
  KIND_VOTE,
  normalizeRelayUrls,
  parsePollFromSignedEvent,
  validateVoteAgainstPoll,
} from "~/features/polls";
import { recordReplyPost } from "~/features/posts/server";
import { persistPublishRelayAcks } from "~/features/relays/publish-relay-acks.server";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import { invalidateRelayIntentCache } from "~/features/user";
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

type ValidatedNostrEvent = ReturnType<
  typeof validateSignedEventCryptographically
>;

async function resolvePublishRelaysForVoteIfNeeded(params: {
  validatedEvent: ValidatedNostrEvent;
  resolvedRelays: string[];
  pollEventRaw: unknown;
  assert: AssertFunction;
}): Promise<string[]> {
  const { validatedEvent, resolvedRelays, pollEventRaw } = params;
  const assertFn: AssertFunction = params.assert;
  if (validatedEvent.kind !== KIND_VOTE) {
    return resolvedRelays;
  }
  if (!featureFlags.nip88PollsEnabled) {
    throw new ValidationError("NIP-88 polls are disabled", {
      route: PUBLISH_API_ROUTE,
    });
  }
  assertFn(
    pollEventRaw !== null && pollEventRaw !== undefined,
    "pollEvent is required for kind 1018 (NIP-88 vote)",
    { hasPollEvent: pollEventRaw != null }
  );
  const validatedPoll = validateSignedEventCryptographically(pollEventRaw);
  const voteCheck = validateVoteAgainstPoll(validatedEvent, validatedPoll);
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
  return normalizeRelayUrls([...resolvedRelays, ...parsedPoll.relayUrls]);
}

function isKind1ReplyEvent(validatedEvent: ValidatedNostrEvent): boolean {
  return (
    validatedEvent.kind === 1 &&
    Array.isArray(validatedEvent.tags) &&
    validatedEvent.tags.some(
      (t) =>
        Array.isArray(t) &&
        t[0] === "e" &&
        (t[3] === "reply" || t[2] === "reply")
    )
  );
}

async function runPublishApiPostPublishSideEffects(params: {
  userId: string;
  validatedEvent: ValidatedNostrEvent;
  publishResult: Awaited<ReturnType<typeof publishSignedEventToRelays>>;
  recordAsReply?: {
    replyToEventId: string;
    replyToPostId?: string | null;
  };
}): Promise<void> {
  const { userId, validatedEvent, publishResult, recordAsReply } = params;

  if (validatedEvent.kind === KIND_RELAY_LIST_NIP65) {
    try {
      await invalidateRelayIntentCache(userId);
    } catch (cacheErr) {
      const { logError } = await import("~/lib/error-logger.server");
      logError(
        cacheErr instanceof Error ? cacheErr : new Error(String(cacheErr)),
        {
          userId,
          message: "API publish: Failed to invalidate relay intent cache",
        }
      );
    }
  }

  try {
    await persistPublishRelayAcks({
      publishAttemptId: `api:${validatedEvent.id}`,
      userId,
      eventId: validatedEvent.id,
      results: publishResult.results,
    });
  } catch (ackError) {
    const { logError } = await import("~/lib/error-logger.server");
    logError(
      ackError instanceof Error ? ackError : new Error(String(ackError)),
      {
        userId,
        eventId: validatedEvent.id,
        publishAttemptId: `api:${validatedEvent.id}`,
        message: "API publish: Failed to persist publish ACKs",
      }
    );
  }

  const isKind1Reply = isKind1ReplyEvent(validatedEvent);
  if (
    recordAsReply &&
    typeof recordAsReply === "object" &&
    typeof recordAsReply.replyToEventId === "string" &&
    recordAsReply.replyToEventId.length > 0 &&
    isKind1Reply
  ) {
    try {
      await recordReplyPost({
        userId,
        signedEvent: validatedEvent,
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
          userId,
          eventId: validatedEvent.id,
          message: "API publish: Failed to create reply Post record",
        }
      );
    }
  }
}

async function runPublishApiAction(request: Request): Promise<Response> {
  const errorHandler = await import("~/lib/error-handler.server");
  const assert: AssertFunction = errorHandler.assert;

  assert(request.method === "POST", "Method not allowed", {
    method: request.method,
  });

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
          pollEvent?: unknown;
          recordAsReply?: {
            replyToEventId: string;
            replyToPostId?: string | null;
          };
        })
      : {};
  const { relays, event, pollEvent: pollEventRaw, recordAsReply } = body;

  assert(event !== null && event !== undefined, "Event is required", {
    hasEvent: event !== null && event !== undefined,
  });

  const session = await requireSession(request);

  void relays;
  const resolvedRelays = await resolveExecutionRelays(session.userId);

  const validatedEvent = validateSignedEventCryptographically(event);
  assertSignedEventMatchesSessionPubkey({
    sessionPubkey: session.pubkey,
    eventPubkey: validatedEvent.pubkey,
    context: { route: PUBLISH_API_ROUTE },
  });

  if (validatedEvent.kind === KIND_RELAY_LIST_NIP65) {
    assertValidKind10002RelayListEvent(validatedEvent);
  }

  const publishRelays = await resolvePublishRelaysForVoteIfNeeded({
    validatedEvent,
    resolvedRelays,
    pollEventRaw,
    assert,
  });

  const publishResult = await publishSignedEventToRelays({
    signedEvent: validatedEvent,
    relays: publishRelays,
  });

  await runPublishApiPostPublishSideEffects({
    userId: session.userId,
    validatedEvent,
    publishResult,
    recordAsReply,
  });

  return json({ success: true });
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      return await runPublishApiAction(request);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);
