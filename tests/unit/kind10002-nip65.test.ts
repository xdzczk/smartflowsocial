import { describe, it, expect } from "vitest";

import {
  createValidSignedEvent,
  getTestPublicKey,
} from "../utils/nostr-test-helpers";

import { assertValidKind10002RelayListEvent } from "~/features/nostr/kind10002-nip65.server";
import { KIND_RELAY_LIST_NIP65 } from "~/features/nostr/nostr-event-kinds";
import type { SignedEvent } from "~/features/nostr/types";

function kind10002Event(tags: string[][], content = ""): SignedEvent {
  return createValidSignedEvent({
    kind: KIND_RELAY_LIST_NIP65,
    content,
    tags,
  });
}

describe("assertValidKind10002RelayListEvent", () => {
  it("accepts valid r tags", () => {
    expect(() =>
      assertValidKind10002RelayListEvent(
        kind10002Event([["r", "wss://relay.example.com"]])
      )
    ).not.toThrow();
  });

  it("rejects non-empty content", () => {
    expect(() =>
      assertValidKind10002RelayListEvent(
        kind10002Event([["r", "wss://relay.example.com"]], "{}")
      )
    ).toThrow();
  });

  it("rejects non-r tags", () => {
    expect(() =>
      assertValidKind10002RelayListEvent(
        kind10002Event([
          ["r", "wss://relay.example.com"],
          ["p", getTestPublicKey()],
        ])
      )
    ).toThrow();
  });

  it("rejects empty tag list", () => {
    expect(() =>
      assertValidKind10002RelayListEvent(kind10002Event([]))
    ).toThrow();
  });
});
