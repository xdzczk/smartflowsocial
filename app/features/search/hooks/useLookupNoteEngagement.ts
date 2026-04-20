import { useCallback, useState } from "react";

import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  ephemeralIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

const PUBLISH_API_ENDPOINT = "/api/publish";

/** Relay marker for `e` tags when publishing replies (server resolves actual publish set). */
const FALLBACK_TAG_RELAY = "wss://relay.primal.net";

export interface UseLookupNoteEngagementParams {
  eventId: string;
  authorPubkey: string;
  /** Used in client tag construction; server resolves execution relays. */
  publishRelays: string[];
}

export interface UseLookupNoteEngagementResult {
  isLiked: boolean;
  isLikeSending: boolean;
  likeError: string | null;
  likeNote: () => Promise<void>;
  /**
   * Ephemeral signing attempt id for the most recent `likeNote()` call,
   * or `null` when no like attempt is in flight. Pipe into
   * `useSigningAttemptById` + `SubtleSignPending` / `CompactSignStatus`
   * to render the per-row escalation tier.
   */
  likeAttemptId: string | null;
  sendReply: (content: string) => Promise<void>;
  isReplySending: boolean;
  replyError: string | null;
  clearReplyError: () => void;
}

export function useLookupNoteEngagement({
  eventId,
  authorPubkey,
  publishRelays,
}: UseLookupNoteEngagementParams): UseLookupNoteEngagementResult {
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeSending, setIsLikeSending] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const [likeAttemptId, setLikeAttemptId] = useState<string | null>(null);
  const [isReplySending, setIsReplySending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const tagRelay =
    publishRelays.length > 0 ? publishRelays[0]! : FALLBACK_TAG_RELAY;

  const likeNote = useCallback(async () => {
    if (isLikeSending || isLiked) return;
    setLikeError(null);
    setLikeAttemptId(null);
    setIsLiked(true);
    setIsLikeSending(true);

    const kind7EventData = {
      kind: 7,
      content: "+",
      tags: [
        ["e", eventId],
        ["p", authorPubkey],
      ],
      created_at: Math.floor(Date.now() / 1000),
    };

    let trackedAttemptId: string | null = null;

    const result = await startRecoverableSign({
      intent: ephemeralIntent("search_engagement_lookup", "Like"),
      surface: `lookup:note:${eventId}`,
      performSignAndSubmit: async (submissionId) => {
        if (trackedAttemptId !== submissionId) {
          trackedAttemptId = submissionId;
          setLikeAttemptId(submissionId);
        }
        const { signedEvent } = await nostrAdapter.signEvent(kind7EventData, {
          clearCacheOnError: false,
        });

        const response = await fetch(PUBLISH_API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            relays: publishRelays,
            event: signedEvent,
          }),
        });

        if (!response.ok) {
          const message = `Failed to publish like (${response.status})`;
          signingAttempts.markFailed(submissionId, message);
          throw new Error(message);
        }
        signingAttempts.markCompleted(submissionId);
      },
    });

    setIsLikeSending(false);

    if (!result.ok) {
      setIsLiked(false);
      // While the attempt is parked in `awaiting_signer`, the per-row
      // CompactSignStatus owns the recovery affordance — only surface a
      // textual error for the terminal failure modes the pill can't
      // recover from.
      if (result.reason === "fatal" || result.reason === "expired") {
        setLikeError("Couldn’t send like. Try again.");
      }
    }
  }, [authorPubkey, eventId, isLiked, isLikeSending, publishRelays]);

  const sendReply = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed) return;

      setReplyError(null);
      setIsReplySending(true);
      try {
        const kind1EventData = {
          kind: 1,
          content: trimmed,
          tags: [
            ["e", eventId, tagRelay, "reply"],
            ["p", authorPubkey],
          ],
          created_at: Math.floor(Date.now() / 1000),
        };

        const { signedEvent } = await nostrAdapter.signEvent(kind1EventData, {
          clearCacheOnError: false,
        });

        const response = await fetch(PUBLISH_API_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            relays: publishRelays,
            event: signedEvent,
            recordAsReply: {
              replyToEventId: eventId,
            },
          }),
        });

        if (!response.ok) throw new Error("Failed to publish reply");
      } catch {
        setReplyError("Couldn’t send reply. Try again.");
        throw new Error("reply_failed");
      } finally {
        setIsReplySending(false);
      }
    },
    [authorPubkey, eventId, publishRelays, tagRelay]
  );

  const clearReplyError = useCallback(() => setReplyError(null), []);

  return {
    isLiked,
    isLikeSending,
    likeError,
    likeNote,
    likeAttemptId,
    sendReply,
    isReplySending,
    replyError,
    clearReplyError,
  };
}
