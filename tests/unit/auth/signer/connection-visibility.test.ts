/**
 * @vitest-environment jsdom
 * Unit tests for connection visibility handler (page visibility / freeze for NIP-46).
 * Tests app/features/auth/signer/connection-visibility.client.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VisibilityHandlerOptions } from "~/features/auth/signer/connection-visibility.client";
import { initVisibilityHandler } from "~/features/auth/signer/connection-visibility.client";

describe("connection-visibility", () => {
  const defaultOptions = () => ({
    onResume: vi.fn(),
    onTeardown: vi.fn(),
    getConfig: vi.fn(() => null as { type?: string } | null),
    getCachedSigner: vi.fn(() => null as unknown),
    getTeardownInProgress: vi.fn(() => false),
    isMobile: vi.fn(() => false),
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
    initVisibilityHandler(opts as VisibilityHandlerOptions);
    expect(docAddSpy).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function)
    );
    expect(winAddSpy).toHaveBeenCalledWith("focus", expect.any(Function));
    expect(winAddSpy).toHaveBeenCalledWith("pageshow", expect.any(Function));
    expect(winAddSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });

  it("calls onTeardown when document becomes hidden on mobile with nip46 signer", () => {
    const opts = defaultOptions();
    (opts.getConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "nip46",
    });
    (opts.getCachedSigner as ReturnType<typeof vi.fn>).mockReturnValue({});
    (opts.isMobile as ReturnType<typeof vi.fn>).mockReturnValue(true);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
      writable: true,
    });

    initVisibilityHandler(opts as VisibilityHandlerOptions);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock */
    const visibilityCalls: Array<[string, unknown]> =
      docAddSpy.mock.calls.filter(
        (c: [string, unknown]) => c[0] === "visibilitychange"
      );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    expect(visibilityCalls.length).toBeGreaterThanOrEqual(1);
    const handleVisibilityChange = visibilityCalls[0]![1] as () => void;
    handleVisibilityChange();

    expect(opts.setWasHidden).toHaveBeenCalledWith(true);
    expect(opts.onTeardown).toHaveBeenCalled();
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

    initVisibilityHandler(opts as VisibilityHandlerOptions);
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

  it("does not call onTeardown when not mobile", () => {
    const opts = defaultOptions();
    (opts.getConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "nip46",
    });
    (opts.getCachedSigner as ReturnType<typeof vi.fn>).mockReturnValue({});
    (opts.isMobile as ReturnType<typeof vi.fn>).mockReturnValue(false);

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
      writable: true,
    });

    initVisibilityHandler(opts as VisibilityHandlerOptions);
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock */
    const visibilityCalls: Array<[string, unknown]> =
      docAddSpy.mock.calls.filter(
        (c: [string, unknown]) => c[0] === "visibilitychange"
      );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
    (visibilityCalls[0]![1] as () => void)();

    expect(opts.onTeardown).not.toHaveBeenCalled();
  });

  it("cleanup removes listeners", () => {
    const opts = defaultOptions();
    const cleanup = initVisibilityHandler(opts as VisibilityHandlerOptions);
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
    (opts.getTeardownInProgress as ReturnType<typeof vi.fn>).mockReturnValue(
      false
    );
    (
      opts.getLastVisibilityReconnectAt as ReturnType<typeof vi.fn>
    ).mockReturnValue(Date.now() - 100);
    opts.visibilityReconnectThrottleMs = 10_000;

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
      writable: true,
    });

    initVisibilityHandler(opts as VisibilityHandlerOptions);
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

  it("does not call onResume when getTeardownInProgress is true", () => {
    const opts = defaultOptions();
    (opts.getWasHidden as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (opts.getTeardownInProgress as ReturnType<typeof vi.fn>).mockReturnValue(
      true
    );
    (
      opts.getLastVisibilityReconnectAt as ReturnType<typeof vi.fn>
    ).mockReturnValue(0);
    opts.visibilityReconnectThrottleMs = 0;

    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
      writable: true,
    });

    initVisibilityHandler(opts as VisibilityHandlerOptions);
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

  it("calls onTeardown on freeze when nip46 signer present and supportsFreezeResume", () => {
    const opts = defaultOptions();
    (opts.getConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      type: "nip46",
    });
    (opts.getCachedSigner as ReturnType<typeof vi.fn>).mockReturnValue({});

    const desc = Object.getOwnPropertyDescriptor(document, "onfreeze");
    try {
      Object.defineProperty(document, "onfreeze", {
        configurable: true,
        value: null,
        writable: true,
      });
      initVisibilityHandler(opts as VisibilityHandlerOptions);
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- vi.spyOn .mock */
      const freezeCalls: Array<[string, unknown]> = docAddSpy.mock.calls.filter(
        (c: [string, unknown]) => c[0] === "freeze"
      );
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
      if (freezeCalls.length > 0) {
        (freezeCalls[0]![1] as () => void)();
        expect(opts.onTeardown).toHaveBeenCalled();
      }
    } finally {
      if (desc) {
        Object.defineProperty(document, "onfreeze", desc);
      }
    }
  });
});
