import { describe, expect, it } from "vitest";

import {
  buildBroadcastUnsubscribeUrl,
  deriveBroadcastUnsubscribeRawToken,
  hashBroadcastUnsubscribeToken,
} from "~/features/broadcast/broadcast-unsubscribe-crypto";

describe("broadcast-unsubscribe-crypto", () => {
  const secret = "x".repeat(32);

  it("derive is stable for same recipient and secret", () => {
    const a = deriveBroadcastUnsubscribeRawToken("rec_cuid123", secret);
    const b = deriveBroadcastUnsubscribeRawToken("rec_cuid123", secret);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("derive differs by recipient id", () => {
    const a = deriveBroadcastUnsubscribeRawToken("rec_a", secret);
    const b = deriveBroadcastUnsubscribeRawToken("rec_b", secret);
    expect(a).not.toBe(b);
  });

  it("hash is stable and hex", () => {
    const raw =
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    expect(hashBroadcastUnsubscribeToken(raw)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("buildBroadcastUnsubscribeUrl encodes token", () => {
    const url = buildBroadcastUnsubscribeUrl("aa", "https://example.com/");
    expect(url).toBe("https://example.com/broadcast/unsubscribe?t=aa");
  });
});
