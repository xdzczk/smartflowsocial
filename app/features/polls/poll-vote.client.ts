/**
 * Client: sign NIP-88 kind 1018 vote and POST /api/publish with parent poll event.
 */

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
  const { signedEvent } = await nostrAdapter.signEventWithOneRetry({
    content: "",
    created_at: Math.floor(Date.now() / 1000),
    kind: KIND_VOTE,
    tags,
  });

  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: signedEvent,
      pollEvent: input.pollSigned,
    }),
  });

  if (!res.ok) {
    let msg = `Publish failed (${res.status})`;
    try {
      const j = (await res.json()) as { error?: string; message?: string };
      if (typeof j.error === "string") msg = j.error;
      else if (typeof j.message === "string") msg = j.message;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
}
