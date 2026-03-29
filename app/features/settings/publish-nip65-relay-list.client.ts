/**
 * Client: sign NIP-65 kind 10002 relay list and POST /api/publish.
 */

import { KIND_RELAY_LIST_NIP65 } from "~/features/nostr/nostr-event-kinds";
import type { Nip65ProfileRelayEntry } from "~/features/relays/nip65-relay-entry";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

function entryToRTag(entry: Nip65ProfileRelayEntry): string[] {
  if (entry.scope === "both") return ["r", entry.url];
  return ["r", entry.url, entry.scope];
}

/**
 * @param entries - one NIP-65 `r` tag per row (`both` → unmarked tag).
 */
export async function publishNip65RelayListToNostr(
  entries: Nip65ProfileRelayEntry[]
): Promise<void> {
  const tags = entries.map((e) => entryToRTag(e));
  const { signedEvent } = await nostrAdapter.signEventWithOneRetry({
    content: "",
    created_at: Math.floor(Date.now() / 1000),
    kind: KIND_RELAY_LIST_NIP65,
    tags,
  });

  const res = await fetch("/api/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: signedEvent }),
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
