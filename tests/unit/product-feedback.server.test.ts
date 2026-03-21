import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/env.server", () => ({
  env: {
    FEEDBACK_INBOX_NPUB: "f".repeat(64),
  },
}));

import type { SignedEvent } from "~/features/nostr/types";
import {
  getFeedbackInboxPubkeyHex,
  validateUserSignedFeedbackDm,
  validateUserSignedFeedbackGiftWrap,
} from "~/features/user/services/product-feedback.server";

function kind4Event(overrides: Partial<SignedEvent> = {}): SignedEvent {
  return {
    id: "e".repeat(64),
    pubkey: "a".repeat(64),
    created_at: 1,
    kind: 4,
    tags: [["p", "f".repeat(64)]],
    content: "encrypted-payload",
    sig: "b".repeat(128),
    ...overrides,
  };
}

function giftWrapEvent(overrides: Partial<SignedEvent> = {}): SignedEvent {
  return {
    id: "c".repeat(64),
    pubkey: "d".repeat(64),
    created_at: 1,
    kind: 1059,
    tags: [["p", "f".repeat(64)]],
    content: "wrap-payload",
    sig: "b".repeat(128),
    ...overrides,
  };
}

describe("getFeedbackInboxPubkeyHex", () => {
  it("returns lowercase hex from env", () => {
    expect(getFeedbackInboxPubkeyHex()).toBe("f".repeat(64));
  });
});

describe("validateUserSignedFeedbackDm", () => {
  const inbox = "f".repeat(64);
  const sessionPk = "a".repeat(64);

  it("rejects non-kind-4", () => {
    const out = validateUserSignedFeedbackDm({
      event: kind4Event({ kind: 1 }),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out.ok).toBe(false);
  });

  it("rejects pubkey mismatch", () => {
    const out = validateUserSignedFeedbackDm({
      event: kind4Event({ pubkey: "c".repeat(64) }),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out.ok).toBe(false);
  });

  it("rejects when p tag does not include inbox", () => {
    const out = validateUserSignedFeedbackDm({
      event: kind4Event({ tags: [["p", "d".repeat(64)]] }),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out.ok).toBe(false);
  });

  it("accepts valid kind-4 to inbox", () => {
    const out = validateUserSignedFeedbackDm({
      event: kind4Event(),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out).toEqual({ ok: true });
  });

  it("matches inbox case-insensitively on p tag", () => {
    const out = validateUserSignedFeedbackDm({
      event: kind4Event({ tags: [["p", "F".repeat(64)]] }),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out).toEqual({ ok: true });
  });
});

describe("validateUserSignedFeedbackGiftWrap", () => {
  const inbox = "f".repeat(64);
  const sessionPk = "a".repeat(64);

  it("rejects non-1059", () => {
    const out = validateUserSignedFeedbackGiftWrap({
      event: giftWrapEvent({ kind: 4 }),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out.ok).toBe(false);
  });

  it("rejects wrong p tag", () => {
    const out = validateUserSignedFeedbackGiftWrap({
      event: giftWrapEvent({ tags: [["p", "9".repeat(64)]] }),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out.ok).toBe(false);
  });

  it("accepts wrap to inbox", () => {
    const out = validateUserSignedFeedbackGiftWrap({
      event: giftWrapEvent(),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out).toEqual({ ok: true });
  });

  it("accepts wrap to session (sender copy)", () => {
    const out = validateUserSignedFeedbackGiftWrap({
      event: giftWrapEvent({ tags: [["p", sessionPk]] }),
      inboxHexLower: inbox,
      sessionPubkey: sessionPk,
    });
    expect(out).toEqual({ ok: true });
  });
});
