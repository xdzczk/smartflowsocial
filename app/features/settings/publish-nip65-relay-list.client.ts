/**
 * Client: sign NIP-65 kind 10002 relay list and POST /api/publish.
 *
 * Wrapped in {@link startRecoverableSign} so a stalled bunker parks the
 * publish under the foreground recovery banner instead of dropping it as a
 * silent failure. The idempotency key is derived from the relay list
 * fingerprint so a resumed retry collapses onto the same server-side dedupe
 * slot (NIP-65 is a kind-10002 replaceable event  -  re-publishing is a no-op
 * at the relay layer, but the route's post-publish side effects must run
 * exactly once).
 */

import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import {
  durableIntent,
  startRecoverableSign,
} from "~/features/auth/signing/use-recoverable-sign.client";
import { KIND_RELAY_LIST_NIP65 } from "~/features/nostr/nostr-event-kinds";
import type { Nip65ProfileRelayEntry } from "~/features/relays/nip65-relay-entry";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

function entryToRTag(entry: Nip65ProfileRelayEntry): string[] {
  if (entry.scope === "both") return ["r", entry.url];
  return ["r", entry.url, entry.scope];
}

function fingerprintEntries(entries: Nip65ProfileRelayEntry[]): string {
  // Stable across resumes of the same intent; changes if the user edits
  // the list (which is a fresh intent that should not collapse onto the
  // previous attempt's dedupe slot).
  return entries
    .map((e) => `${e.scope}|${e.url}`)
    .sort((a, b) => a.localeCompare(b))
    .join(";");
}

/**
 * @param entries - one NIP-65 `r` tag per row (`both` → unmarked tag).
 */
export async function publishNip65RelayListToNostr(
  entries: Nip65ProfileRelayEntry[]
): Promise<void> {
  const tags = entries.map((e) => entryToRTag(e));
  const idempotencyKey = `nip65:${fingerprintEntries(entries)}`;

  const result = await startRecoverableSign({
    intent: durableIntent("nip65_publish", idempotencyKey, "Update relay list"),
    surface: "settings:nip65",
    performSignAndSubmit: async (submissionId) => {
      const { signedEvent } = await nostrAdapter.signEvent(
        {
          content: "",
          created_at: Math.floor(Date.now() / 1000),
          kind: KIND_RELAY_LIST_NIP65,
          tags,
        },
        { clearCacheOnError: false }
      );

      const res = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: signedEvent,
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
    throw new Error(
      result.lastError ??
        (result.reason === "expired"
          ? "Recovery window expired before your signer reconnected."
          : "Failed to publish relay list")
    );
  }
}
