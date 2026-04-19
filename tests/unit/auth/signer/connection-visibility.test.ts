/**
 * @vitest-environment jsdom
 * Unit tests for connection visibility handler (page visibility for NIP-46).
 * Tests app/features/auth/signer/connection-visibility.client.ts
 *
 * The handler no longer tears down the signer on hidden/freeze; it only fires
 * `onResume` when the page becomes visible again, throttled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VisibilityHandlerOptions } from "~/features/auth/signer/connection-visibility.client";
import { initVisibilityHandler } from "~/features/auth/signer/connection-visibility.client";

describe("connection-visibility", () => {
  const defaultOptions = (): VisibilityHandlerOptions => ({
    onResume: vi.fn(),
    getWasHidden: vi.fn(() => false),
    setWasHidden: vi.fn(),
    getLastVisibilityReconnectAt: vi.fn(() => 0),
    setLastVisibilityReconnectAt: vi.fn(),
    visibilityReconnectThrottleMs: 1000,
    debugTrace: vi.fn(),
  });

  let docAddSpy: ReturnType<typeof vi.spyOn>;
  let docRemoveSpy: ReturnType<typeof vi.spyOn>;
  let winAddSpy: ReturnType<typeof vi.spyOn>;
  let winRemoveSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    docAddSpy = vi.spyOn(document, "addEventListener");
    docRemoveSpy = vi.spyOn(document, "removeEventListener");
    winAddSpy = vi.spyOn(window, "addEventListener");
    winRemoveSpy = vi.spyOn(window, "removeEventListener");
  });

  afterEach(() => {
    /* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn return type */
    docAddSpy.mockRestore();
    docRemoveSpy.mockRestore();
    winAddSpy.mockRestore();
    winRemoveSpy.mockRestore();
    /* eslint-enable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    vi.clearAllMocks();
  });

  it("returns noop when document is undefined", () => {
    const doc = globalThis.document;
    try {
      (globalThis as unknown as { document: undefined }).document = undefined;
      const opts = defaultOptions();
      const cleanup = initVisibilityHandler(opts);
      expect(typeof cleanup).toBe("function");
      cleanup();
      expect(docAddSpy).not.toHaveBeenCalled();
    } finally {
      (globalThis as unknown as { document: typeof doc }).document = doc;
    }
  });

  it("registers visibilitychange, focus, pageshow, online listeners", () => {
    const opts = defaultOptions();
    initVisibilityHandler(opts);
    expect(docAddSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
    expect(winAddSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(winAddSpy).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(winAddSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });

  it("does not register freeze or resume listeners", () => {
    const opts = defaultOptions();
    initVisibilityHandler(opts);
    const docAddCalls = (
      docAddSpy as unknown as { mock: { calls: Array<[string, unknown]> } }
    ).mock.calls;
    const freezeCalls = docAddCalls.filter((c) => c[0] === "freeze");
    const resumeCalls = docAddCalls.filter((c) => c[0] === "resume");
    expect(freezeCalls.length).toBe(0);
    expect(resumeCalls.length).toBe(0);
  });

  it("flips wasHidden=true when document becomes hidden, never tears down", () => {
    const opts = defaultOptions();

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
      writable: true,
    });

    initVisibilityHandler(opts);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock */
    const visibilityCalls: Array<[string, unknown]> =
      docAddSpy.mock.calls.filter(
        (c: [string, unknown]) => c[0] === "visibilitychange"
      );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    const handleVisibilityChange = visibilityCalls[0]![1] as () => void;
    handleVisibilityChange();

    expect(opts.setWasHidden).toHaveBeenCalledWith(true);
    expect(opts.onResume).not.toHaveBeenCalled();
  });

  it("calls onResume when document becomes visible after was hidden and throttle passed", () => {
    const opts = defaultOptions();
    (opts.getWasHidden as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (
      opts.getLastVisibilityReconnectAt as ReturnType<typeof vi.fn>
    ).mockReturnValue(0);
    opts.visibilityReconnectThrottleMs = 0;

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
      writable: true,
    });

    initVisibilityHandler(opts);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock */
    const visibilityCalls: Array<[string, unknown]> =
      docAddSpy.mock.calls.filter(
        (c: [string, unknown]) => c[0] === "visibilitychange"
      );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    const handleVisibilityChange = visibilityCalls[0]![1] as () => void;
    handleVisibilityChange();

    expect(opts.setWasHidden).toHaveBeenCalledWith(false);
    expect(opts.setLastVisibilityReconnectAt).toHaveBeenCalled();
    expect(opts.onResume).toHaveBeenCalled();
  });

  it("cleanup removes the listeners it added", () => {
    const opts = defaultOptions();
    const cleanup = initVisibilityHandler(opts);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock */
    const visCall = docAddSpy.mock.calls.find(
      (c: [string, unknown]) => c[0] === "visibilitychange"
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    expect(visCall).toBeDefined();

    cleanup();

    expect(docRemoveSpy).toHaveBeenCalledWith(
      "visibilitychange",
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- visCall from find()
      visCall![1]
    );
    expect(winRemoveSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(winRemoveSpy).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(winRemoveSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });

  it("does not call onResume when throttle has not passed since last visibility reconnect", () => {
    const opts = defaultOptions();
    (opts.getWasHidden as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (
      opts.getLastVisibilityReconnectAt as ReturnType<typeof vi.fn>
    ).mockReturnValue(Date.now() - 100);
    opts.visibilityReconnectThrottleMs = 10_000;

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
      writable: true,
    });

    initVisibilityHandler(opts);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock */
    const visibilityCalls: Array<[string, unknown]> =
      docAddSpy.mock.calls.filter(
        (c: [string, unknown]) => c[0] === "visibilitychange"
      );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    (visibilityCalls[0]![1] as () => void)();

    expect(opts.setWasHidden).toHaveBeenCalledWith(false);
    expect(opts.onResume).not.toHaveBeenCalled();
  });

  it("calls onResume when focus fires and getWasHidden was true", () => {
    const opts = defaultOptions();
    (opts.getWasHidden as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (
      opts.getLastVisibilityReconnectAt as ReturnType<typeof vi.fn>
    ).mockReturnValue(0);
    opts.visibilityReconnectThrottleMs = 0;

    initVisibilityHandler(opts);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn return type .mock.calls */
    const focusCalls = winAddSpy.mock.calls.filter(
      (c: [string, unknown]) => c[0] === "focus"
    );
    expect(focusCalls.length).toBeGreaterThanOrEqual(1);
    (focusCalls[0]![1] as () => void)();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    expect(opts.setWasHidden).toHaveBeenCalledWith(false);
    expect(opts.onResume).toHaveBeenCalled();
  });

  it("calls onResume when pageshow fires and getWasHidden was true", () => {
    const opts = defaultOptions();
    (opts.getWasHidden as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (
      opts.getLastVisibilityReconnectAt as ReturnType<typeof vi.fn>
    ).mockReturnValue(0);
    opts.visibilityReconnectThrottleMs = 0;

    initVisibilityHandler(opts);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock.calls */
    const pageshowCalls = winAddSpy.mock.calls.filter(
      (c: [string, unknown]) => c[0] === "pageshow"
    );
    expect(pageshowCalls.length).toBeGreaterThanOrEqual(1);
    (pageshowCalls[0]![1] as () => void)();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    expect(opts.setWasHidden).toHaveBeenCalledWith(false);
    expect(opts.onResume).toHaveBeenCalled();
  });

  it("calls onResume when online fires", () => {
    const opts = defaultOptions();
    (opts.getWasHidden as ReturnType<typeof vi.fn>).mockReturnValue(false);
    (
      opts.getLastVisibilityReconnectAt as ReturnType<typeof vi.fn>
    ).mockReturnValue(0);
    opts.visibilityReconnectThrottleMs = 0;

    initVisibilityHandler(opts);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock.calls */
    const onlineCalls = winAddSpy.mock.calls.filter(
      (c: [string, unknown]) => c[0] === "online"
    );
    expect(onlineCalls.length).toBeGreaterThanOrEqual(1);
    (onlineCalls[0]![1] as () => void)();
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    expect(opts.onResume).toHaveBeenCalled();
  });
});
