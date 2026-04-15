/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAndSignFeedbackKind4,
  buildUserSignedFeedbackNip17GiftWraps,
  feedbackClientMayAttemptNip17Seals,
  feedbackClientNip17Eligible,
} from "~/lib/product-feedback-dm.client";

const mocks = vi.hoisted(() => ({
  getActiveSignerConfig: vi.fn(),
  signEvent: vi.fn(),
  signEventWithOneRetry: vi.fn(),
  encryptNip04WithActiveSigner: vi.fn(),
  encryptNip44WithActiveSigner: vi.fn(),
  generateSecretKey: vi.fn(),
  getConversationKey: vi.fn(),
  encrypt: vi.fn(),
  finalizeEvent: vi.fn(),
  getEventHash: vi.fn(),
}));

vi.mock("~/features/auth/signer", () => ({
  getActiveSignerConfig: (...args: unknown[]) =>
    mocks.getActiveSignerConfig(...args),
}));
vi.mock("~/lib/nostr-adapter.client", () => ({
  nostrAdapter: {
    signEvent: (...args: unknown[]) => mocks.signEvent(...args),
    signEventWithOneRetry: (...args: unknown[]) =>
      mocks.signEventWithOneRetry(...args),
  },
}));
vi.mock("~/lib/nostr-signer-encrypt.client", () => ({
  encryptNip04WithActiveSigner: (...args: unknown[]) =>
    mocks.encryptNip04WithActiveSigner(...args),
  encryptNip44WithActiveSigner: (...args: unknown[]) =>
    mocks.encryptNip44WithActiveSigner(...args),
}));
vi.mock("nostr-tools/kinds", () => ({
  GiftWrap: 1059,
  PrivateDirectMessage: 14,
  Seal: 13,
}));
vi.mock("nostr-tools/nip44", () => ({
  getConversationKey: (...args: unknown[]) => mocks.getConversationKey(...args),
  encrypt: (...args: unknown[]) => mocks.encrypt(...args),
}));
vi.mock("nostr-tools/pure", () => ({
  finalizeEvent: (...args: unknown[]) => mocks.finalizeEvent(...args),
  generateSecretKey: (...args: unknown[]) => mocks.generateSecretKey(...args),
  getEventHash: (...args: unknown[]) => mocks.getEventHash(...args),
}));

describe("product-feedback-dm client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveSignerConfig.mockReturnValue(null);
    (window as unknown as { nostr?: unknown }).nostr = undefined;
    mocks.encryptNip04WithActiveSigner.mockResolvedValue("enc-04");
    mocks.encryptNip44WithActiveSigner.mockResolvedValue("enc-44");
    mocks.signEvent.mockResolvedValue({ signedEvent: { id: "signed-4" } });
    mocks.signEventWithOneRetry.mockResolvedValue({
      signedEvent: { id: "sealed", content: "seal" },
    });
    mocks.generateSecretKey.mockReturnValue(new Uint8Array([1, 2, 3]));
    mocks.getConversationKey.mockReturnValue("conv-key");
    mocks.encrypt.mockReturnValue("wrapped");
    mocks.getEventHash.mockReturnValue("rumor-id");
    mocks.finalizeEvent.mockImplementation((event: unknown) => ({
      id: "gift-id",
      ...(event as Record<string, unknown>),
    }));
  });

  it("evaluates NIP-17 eligibility and seal capability", () => {
    expect(
      feedbackClientNip17Eligible({
        nostrDmNip17Enabled: true,
        feedbackInboxKind10050Relays: ["wss://relay"],
      })
    ).toBe(true);
    expect(
      feedbackClientNip17Eligible({
        nostrDmNip17Enabled: false,
        feedbackInboxKind10050Relays: ["wss://relay"],
      })
    ).toBe(false);

    expect(feedbackClientMayAttemptNip17Seals()).toBe(false);
    mocks.getActiveSignerConfig.mockReturnValue({ type: "nip46" });
    expect(feedbackClientMayAttemptNip17Seals()).toBe(true);
  });

  it("builds signed NIP-17 gift wraps for sender and inbox recipients", async () => {
    const wraps = await buildUserSignedFeedbackNip17GiftWraps({
      plaintext: "hello",
      senderPubkeyHex: "A".repeat(64),
      inboxPubkeyHex: "B".repeat(64),
      preferredInboxRelayUrl: " wss://relay.example ",
    });

    expect(wraps).toHaveLength(2);
    expect(mocks.encryptNip44WithActiveSigner).toHaveBeenCalledTimes(2);
    expect(mocks.signEvent).toHaveBeenCalledTimes(2);
    expect(mocks.finalizeEvent).toHaveBeenCalledTimes(2);
  });

  it("builds and signs kind-4 feedback event", async () => {
    const event = await buildAndSignFeedbackKind4({
      recipientPubkeyHex: "ABC",
      plaintext: "feedback text",
    });
    expect(mocks.encryptNip04WithActiveSigner).toHaveBeenCalledWith(
      "abc",
      "feedback text"
    );
    expect(mocks.signEvent).toHaveBeenCalled();
    expect(event).toEqual({ id: "signed-4" });
  });
});
