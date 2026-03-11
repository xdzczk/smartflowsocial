/**
 * Scenario / chaos tests for STALE event, visibility, and health check
 * interacting with reconnect. Uses mocks and fake timers; no real relay.
 *
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NOSTR_CONNECTION_HEALTHY_EVENT,
  NOSTR_CONNECTION_STALE_EVENT,
} from "~/features/auth/signer/connection-constants";

const mockTryBackgroundReconnect = vi.fn();
vi.mock(
  "~/features/auth/signer/nostr-signer-connection.client",
  async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
      ...actual,
      tryBackgroundReconnect: (...args: unknown[]) =>
        mockTryBackgroundReconnect(...args),
    };
  }
);

describe("reconnect scenarios", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockTryBackgroundReconnect.mockReset();
  });

  afterEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.restoreAllMocks();
  });

  it("(1) when NOSTR_CONNECTION_STALE_EVENT is dispatched and tryBackgroundReconnect is invoked, it is called once and on success dispatches NOSTR_CONNECTION_HEALTHY_EVENT", async () => {
    const healthyEvents: CustomEvent[] = [];
    const handleHealthy = (e: Event) => {
      healthyEvents.push(e as CustomEvent);
    };
    window.addEventListener(NOSTR_CONNECTION_HEALTHY_EVENT, handleHealthy);

    mockTryBackgroundReconnect.mockImplementation(() => {
      window.dispatchEvent(new CustomEvent(NOSTR_CONNECTION_HEALTHY_EVENT));
      return Promise.resolve(true);
    });

    const { tryBackgroundReconnect } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    const handleStale = () => {
      void tryBackgroundReconnect();
    };
    window.addEventListener(NOSTR_CONNECTION_STALE_EVENT, handleStale);

    window.dispatchEvent(
      new CustomEvent(NOSTR_CONNECTION_STALE_EVENT, {
        detail: { signerType: "nip46" },
      })
    );
    await vi.runAllTimersAsync();

    expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);
    expect(healthyEvents.length).toBeGreaterThanOrEqual(1);

    window.removeEventListener(NOSTR_CONNECTION_STALE_EVENT, handleStale);
    window.removeEventListener(NOSTR_CONNECTION_HEALTHY_EVENT, handleHealthy);
  });

  it("(2) when reconnect is in progress and visibility becomes hidden, no second reconnect is started", async () => {
    let resolveReconnect!: (value: boolean) => void;
    const reconnectPromise = new Promise<boolean>((resolve) => {
      resolveReconnect = resolve;
    });
    mockTryBackgroundReconnect.mockReturnValue(reconnectPromise);

    const { tryBackgroundReconnect } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    void tryBackgroundReconnect();
    await vi.runAllTimersAsync();

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      writable: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.runAllTimersAsync();

    resolveReconnect(true);
    await vi.runAllTimersAsync();

    expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(1);
  });

  it("(3) health check interval does not trigger reconnect while already reconnecting", async () => {
    let resolveReconnect!: (value: boolean) => void;
    mockTryBackgroundReconnect.mockReturnValue(
      new Promise<boolean>((resolve) => {
        resolveReconnect = resolve;
      })
    );

    const { tryBackgroundReconnect } =
      await import("~/features/auth/signer/nostr-signer-connection.client");
    void tryBackgroundReconnect();
    await vi.runAllTimersAsync();

    void tryBackgroundReconnect();
    await vi.runAllTimersAsync();

    expect(mockTryBackgroundReconnect).toHaveBeenCalledTimes(2);
    resolveReconnect(true);
    await vi.runAllTimersAsync();
  });
});
