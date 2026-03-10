/**
 * Unit tests for NIP-46 persist (persistNip46LoginSession).
 * Tests app/features/auth/nip46/nip46-persist.client.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/features/auth/signer", () => ({
  setActiveSignerConfig: vi.fn(),
  setCurrentUserNpub: vi.fn(),
  matchOrCreateSession: vi.fn().mockReturnValue({
    id: "conn-1",
    config: {
      type: "nip46",
      method: "bunker_input",
      bunkerInput: "x",
      clientSecretKeyHex: "ab",
    },
    metadata: {
      pubkey: "hex",
      status: "active",
      connectedAt: 0,
      lastActivityAt: 0,
    },
  }),
  setActiveSession: vi.fn(),
  detectSignerAppName: vi.fn().mockReturnValue("Primal"),
  updateSession: vi.fn(),
  recordConnectionEvent: vi.fn(),
}));

vi.mock("~/lib/nostr-conversion", () => ({
  convertHexToNpub: vi.fn().mockReturnValue("npub1abc"),
}));

import { persistNip46LoginSession } from "~/features/auth/nip46/nip46-persist.client";
import {
  setActiveSignerConfig,
  setCurrentUserNpub,
  matchOrCreateSession,
  setActiveSession,
  detectSignerAppName,
  updateSession,
  recordConnectionEvent,
} from "~/features/auth/signer";
import { convertHexToNpub } from "~/lib/nostr-conversion";

describe("nip46-persist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (matchOrCreateSession as ReturnType<typeof vi.fn>).mockReturnValue({
      id: "conn-1",
      config: {
        type: "nip46",
        method: "bunker_input",
        bunkerInput: "x",
        clientSecretKeyHex: "ab",
      },
      metadata: {
        pubkey: "hex",
        status: "active",
        connectedAt: 0,
        lastActivityAt: 0,
      },
    });
  });

  it("calls signer APIs in order and returns connectionView from matchOrCreateSession", () => {
    const config = {
      type: "nip46" as const,
      method: "bunker_input" as const,
      bunkerInput: "bunker+nostr://...",
      clientSecretKeyHex: "ab".repeat(32),
    };
    const pubkey = "pubkey-hex-123";

    const result = persistNip46LoginSession(config, pubkey);

    expect(setActiveSignerConfig).toHaveBeenCalledWith(config);
    expect(convertHexToNpub).toHaveBeenCalledWith(pubkey);
    expect(setCurrentUserNpub).toHaveBeenCalledWith("npub1abc");
    expect(matchOrCreateSession).toHaveBeenCalledWith(config, {
      signerPubkey: pubkey,
    });
    expect(setActiveSession).toHaveBeenCalledWith("conn-1");
    expect(detectSignerAppName).toHaveBeenCalledWith(config);

    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- Vitest expect.objectContaining */
    expect(updateSession).toHaveBeenCalledWith(
      "conn-1",
      expect.objectContaining({
        metadata: expect.objectContaining({
          pubkey,
          signerAppName: "Primal",
          status: "active",
        }),
      })
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    expect(recordConnectionEvent).toHaveBeenCalledWith("conn-1", {
      type: "connected",
      pubkey,
    });
    expect(result.id).toBe("conn-1");
    expect(result.config.type).toBe("nip46");
  });
});
