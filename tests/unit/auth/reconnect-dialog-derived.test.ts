/**
 * Unit tests for reconnect-dialog-derived (getCanRetryExisting, getReconnectStartLabel, getHandlePrimaryAction).
 */

import { describe, expect, it, vi } from "vitest";

import type { ReconnectSessionView } from "~/features/auth/reconnect/reconnect-dialog-derived.client";
import {
  getCanRetryExisting,
  getReconnectStartLabel,
  getHandlePrimaryAction,
} from "~/features/auth/reconnect/reconnect-dialog-derived.client";
import type { ActiveSignerConfig } from "~/features/auth/signer";

function minimalNostrConnectSessionView(): ReconnectSessionView {
  const config: ActiveSignerConfig = {
    type: "nip46",
    method: "nostrconnect_uri",
    uri: "",
    relays: [],
    clientSecretKeyHex: "",
  };
  return {
    connection: {
      id: "",
      label: "",
      config,
      metadata: {
        status: "inactive",
        signerAppName: null,
        pubkey: null,
        relays: [],
        connectedAt: null,
        lastActivityAt: null,
        lastError: null,
        createdAt: 0,
        updatedAt: 0,
      },
      currentSessionId: null,
    },
    currentSession: null,
  };
}

describe("reconnect-dialog-derived", () => {
  describe("getCanRetryExisting", () => {
    it("returns false when state is not idle", () => {
      expect(
        getCanRetryExisting(
          "reconnecting_existing",
          "Could not reconnect with existing connection",
          () => minimalNostrConnectSessionView(),
          () => null
        )
      ).toBe(false);
    });

    it("returns false when error does not contain retry message", () => {
      expect(
        getCanRetryExisting(
          "idle",
          "Other error",
          () => minimalNostrConnectSessionView(),
          () => null
        )
      ).toBe(false);
    });

    it("returns false when getPendingReconnect returns truthy", () => {
      expect(
        getCanRetryExisting(
          "idle",
          "Could not reconnect with existing connection",
          () => minimalNostrConnectSessionView(),
          () => ({ uri: "x" })
        )
      ).toBe(false);
    });

    it("returns true when idle, retry error, valid nip46 session, no pending", () => {
      expect(
        getCanRetryExisting(
          "idle",
          "Could not reconnect with existing connection",
          () => minimalNostrConnectSessionView(),
          () => null
        )
      ).toBe(true);
    });
  });

  describe("getReconnectStartLabel", () => {
    it("returns Reconnecting… when state is reconnecting_existing", () => {
      expect(
        getReconnectStartLabel(
          "reconnecting_existing",
          "nostrconnect",
          false,
          null
        )
      ).toBe("Reconnecting…");
    });

    it("returns Waiting for signer… when state is waiting", () => {
      expect(
        getReconnectStartLabel("waiting", "nostrconnect", false, "uri")
      ).toBe("Waiting for signer…");
    });

    it("returns Connect signer when tab is bunker", () => {
      expect(getReconnectStartLabel("idle", "bunker", false, null)).toBe(
        "Connect signer"
      );
    });

    it("returns Try again with existing connection when canRetryExisting", () => {
      expect(getReconnectStartLabel("idle", "nostrconnect", true, null)).toBe(
        "Try again with existing connection"
      );
    });

    it("returns Retry when nostrConnectUri present and not canRetryExisting", () => {
      expect(
        getReconnectStartLabel(
          "idle",
          "nostrconnect",
          false,
          "nostrconnect://x"
        )
      ).toBe("Retry");
    });

    it("returns Generate link when no uri and not canRetryExisting", () => {
      expect(getReconnectStartLabel("idle", "nostrconnect", false, null)).toBe(
        "Generate link"
      );
    });
  });

  describe("getHandlePrimaryAction", () => {
    it("invokes tryReconnectWithExistingConnection when canRetryExisting and not bunker", () => {
      const tryNostr = vi.fn();
      const tryBunker = vi.fn();
      const resume = vi.fn();
      const connect = vi.fn();
      const getActiveSession = (): ReconnectSessionView =>
        minimalNostrConnectSessionView();
      const handler = getHandlePrimaryAction(
        true,
        "nostrconnect",
        () => null,
        getActiveSession,
        tryNostr,
        tryBunker,
        resume,
        connect
      );
      handler();
      expect(tryNostr).toHaveBeenCalledWith("manual_retry");
      expect(tryBunker).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it("invokes resumeReconnectWithPendingUri when tab is nostrconnect and has pending", () => {
      const tryNostr = vi.fn();
      const tryBunker = vi.fn();
      const resume = vi.fn();
      const connect = vi.fn();
      const handler = getHandlePrimaryAction(
        false,
        "nostrconnect",
        () => ({ uri: "x" }),
        () => null,
        tryNostr,
        tryBunker,
        resume,
        connect
      );
      handler();
      expect(resume).toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it("invokes connect when no retry and no pending", () => {
      const tryNostr = vi.fn();
      const tryBunker = vi.fn();
      const resume = vi.fn();
      const connect = vi.fn();
      const handler = getHandlePrimaryAction(
        false,
        "nostrconnect",
        () => null,
        () => null,
        tryNostr,
        tryBunker,
        resume,
        connect
      );
      handler();
      expect(connect).toHaveBeenCalled();
      expect(resume).not.toHaveBeenCalled();
    });
  });
});
