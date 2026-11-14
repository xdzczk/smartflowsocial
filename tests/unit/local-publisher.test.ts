import { finalizeEvent } from "nostr-tools";
import { describe, expect, it } from "vitest";

import { createLocalPublisher } from "../../scripts/local-publisher.mjs";

const secretKey = Uint8Array.from({ length: 32 }, (_, index) => index + 1);

function signedEvent(content: string) {
  return finalizeEvent(
    {
      kind: 1,
      created_at: 1_700_000_000,
      tags: [],
      content,
    },
    secretKey
  );
}

describe("local publisher", () => {
  it("rejects a missing token and an invalid signature, then accepts a signed event", async () => {
    const publisher = createLocalPublisher({ token: "local-token" }) as {
      listen: (port?: number) => Promise<number>;
      close: () => Promise<void>;
      received: Array<{ event: { id?: string } }>;
    };
    const port = await publisher.listen(0);
    const url = `http://127.0.0.1:${port}/publish`;
    try {
      const unauthenticated = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ relays: ["wss://relay.example"], event: {} }),
      });
      expect(unauthenticated.status).toBe(401);

      const event = signedEvent("hello");
      const broken = { ...event, sig: "00".repeat(64) };
      const invalid = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "api-token": "local-token",
        },
        body: JSON.stringify({
          relays: ["wss://relay.example"],
          event: broken,
        }),
      });
      expect(invalid.status).toBe(400);
      expect(publisher.received).toHaveLength(0);

      const accepted = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "api-token": "local-token",
        },
        body: JSON.stringify({
          relays: ["wss://relay.example"],
          event,
        }),
      });
      expect(accepted.status).toBe(200);
      const body = (await accepted.json()) as {
        results: Array<{ relay: string; ok: boolean }>;
      };
      expect(body.results).toEqual([
        { relay: "wss://relay.example", ok: true, latencyMs: 1 },
      ]);
      expect(publisher.received).toHaveLength(1);
      expect(publisher.received[0]?.event["id"]).toBe(event.id);
    } finally {
      await publisher.close();
    }
  });
});
