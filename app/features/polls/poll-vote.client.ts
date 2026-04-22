/**
 * Client: sign NIP-88 kind 1018 vote and POST /api/publish with parent poll event.
 *
 * Vote publishing is durable: a missed vote silently dropped by a stalled
 * bunker is a real correctness loss (the user thought they voted), so the
 * call is wrapped in {@link startRecoverableSign} with a deterministic
 * idempotency key derived from the poll id + the user's chosen options.
 * That collapses any resumed retry onto the same server-side dedupe slot.
 */

import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import type { SignedEvent } from "~/features/nostr/types";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import { KIND_VOTE } from "./nip88";

export async function publishPollVote(input: {
  pollSigned: SignedEvent;
  optionIds: string[];
}): Promise<void> {
  const tags: string[][] = [
    ["e", input.pollSigned.id],
    ...input.optionIds.map((id) => ["response", id] as [string, string]),
  ];
  // Stable across resumes for the same vote; changes if the user reopens
  // the modal and picks a different option set (which is a fresh intent).
  const idempotencyKey = `poll_vote:${input.pollSigned.id}:${[
    ...input.optionIds,
  ]
    .sort()
    .join(",")}`;

  const result = await startRecoverableSign({
    intent: durableIntent("publish_poll_vote", idempotencyKey, "Vote"),
    surface: `poll:${input.pollSigned.id}`,
    performSignAndSubmit: async (submissionId) => {
      const { signedEvent } = await nostrAdapter.signEvent(
        {
          content: "",
          created_at: Math.floor(Date.now() / 1000),
          kind: KIND_VOTE,
          tags,
        },
        { clearCacheOnError: false }
      );

      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: signedEvent,
          pollEvent: input.pollSigned,
          attemptId: submissionId,
        }),
      });

      if (!res.ok) {
        let msg = `Publish failed (${res.status})`;
        try {
          const j = (await res.json()) as { error?: string; message?: string };
          if (typeof j.error === "string") msg = j.error;
          else if (typeof j.message === "string") msg = j.message;
        } catch {
          // Body wasn't JSON; keep the status-coded fallback message.
        }
        signingAttempts.markFailed(submissionId, msg);
        throw new Error(msg);
      }
      signingAttempts.markCompleted(submissionId);
    },
  });

  if (!result.ok) {
    // Preserve the historical throwing contract so existing callers'
    // try/catch wiring still surfaces the error to the user. The
    // recovery banner is already showing for `awaiting_signer`/`expired`
    // — the throw here is the secondary signal for the non-banner
    // branches (fatal, cancelled).
    throw new Error(
      result.lastError ??
        (result.reason === "expired"
          ? "Recovery window expired before your signer reconnected."
          : "Failed to publish vote")
    );
  }
}
