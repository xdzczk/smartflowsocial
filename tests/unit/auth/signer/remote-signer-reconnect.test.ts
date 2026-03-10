/**
 * @vitest-environment jsdom
 * Unit tests for remote signer reconnect event helpers.
 * Tests app/features/auth/signer/remote-signer-reconnect.client.ts
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  REMOTE_SIGNER_TIMEOUT_EVENT,
  OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
  emitRemoteSignerTimeoutEvent,
  emitOpenRemoteSignerReconnectDialogEvent,
} from "~/features/auth/signer/remote-signer-reconnect.client";

describe("remote-signer-reconnect", () => {
  beforeEach(() => {
    // ensure window is present (jsdom)
  });

  afterEach(() => {
    // no mocks to restore
  });

  describe("emitRemoteSignerTimeoutEvent", () => {
    it("dispatches event with detail when window exists", () => {
      let received: unknown = null;
      const handler = (e: Event) => {
        received = (e as CustomEvent).detail;
      };
      window.addEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
      emitRemoteSignerTimeoutEvent({ message: "timeout" });
      expect(received).toEqual({ message: "timeout" });
      window.removeEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
    });

    it("dispatches with empty detail by default", () => {
      let received: unknown = null;
      const handler = (e: Event) => {
        received = (e as CustomEvent).detail;
      };
      window.addEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
      emitRemoteSignerTimeoutEvent();
      expect(received).toEqual({});
      window.removeEventListener(REMOTE_SIGNER_TIMEOUT_EVENT, handler);
    });

    it("does not throw when window is undefined", () => {
      const win = globalThis.window;
      try {
        (globalThis as unknown as { window: undefined }).window = undefined;
        expect(() => emitRemoteSignerTimeoutEvent()).not.toThrow();
      } finally {
        (globalThis as unknown as { window: typeof win }).window = win;
      }
    });
  });

  describe("emitOpenRemoteSignerReconnectDialogEvent", () => {
    it("dispatches event with detail when window exists", () => {
      let received: unknown = null;
      const handler = (e: Event) => {
        received = (e as CustomEvent).detail;
      };
      window.addEventListener(
        OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
        handler
      );
      emitOpenRemoteSignerReconnectDialogEvent({ mode: "new_session" });
      expect(received).toEqual({ mode: "new_session" });
      window.removeEventListener(
        OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
        handler
      );
    });

    it("dispatches with empty detail by default", () => {
      let received: unknown = null;
      const handler = (e: Event) => {
        received = (e as CustomEvent).detail;
      };
      window.addEventListener(
        OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
        handler
      );
      emitOpenRemoteSignerReconnectDialogEvent();
      expect(received).toEqual({});
      window.removeEventListener(
        OPEN_REMOTE_SIGNER_RECONNECT_DIALOG_EVENT,
        handler
      );
    });

    it("does not throw when window is undefined", () => {
      const win = globalThis.window;
      try {
        (globalThis as unknown as { window: undefined }).window = undefined;
        expect(() => emitOpenRemoteSignerReconnectDialogEvent()).not.toThrow();
      } finally {
        (globalThis as unknown as { window: typeof win }).window = win;
      }
    });
  });
});
