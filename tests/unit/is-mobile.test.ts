/**
 * @vitest-environment jsdom
 * Unit tests for isMobile detection
 * Tests app/lib/is-mobile.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("isMobile", () => {
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    vi.resetModules();
  });

  it("returns false when navigator.userAgent is missing", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { userAgent: "", maxTouchPoints: 0 },
      writable: true,
      configurable: true,
    });
    const { isMobile } = await import("~/lib/is-mobile");
    expect(isMobile()).toBe(false);
  });

  it("returns true for Android userAgent", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36",
      },
      writable: true,
      configurable: true,
    });
    const { isMobile } = await import("~/lib/is-mobile");
    expect(isMobile()).toBe(true);
  });

  it("returns true for iPhone userAgent", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
      },
      writable: true,
      configurable: true,
    });
    const { isMobile } = await import("~/lib/is-mobile");
    expect(isMobile()).toBe(true);
  });

  it("returns false for desktop userAgent", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        maxTouchPoints: 0,
      },
      writable: true,
      configurable: true,
    });
    const { isMobile } = await import("~/lib/is-mobile");
    expect(isMobile()).toBe(false);
  });

  it("returns true when maxTouchPoints > 1", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        maxTouchPoints: 2,
      },
      writable: true,
      configurable: true,
    });
    const { isMobile } = await import("~/lib/is-mobile");
    expect(isMobile()).toBe(true);
  });

  it("returns false when navigator is undefined", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const { isMobile } = await import("~/lib/is-mobile");
    expect(isMobile()).toBe(false);
  });
});

describe("isAndroid", () => {
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    vi.resetModules();
  });

  it("returns true when userAgent contains Android", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36",
      },
      writable: true,
      configurable: true,
    });
    const { isAndroid } = await import("~/lib/is-mobile");
    expect(isAndroid()).toBe(true);
  });

  it("returns false for iPhone", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: {
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      },
      writable: true,
      configurable: true,
    });
    const { isAndroid } = await import("~/lib/is-mobile");
    expect(isAndroid()).toBe(false);
  });

  it("returns false when navigator is undefined", async () => {
    Object.defineProperty(globalThis, "navigator", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    const { isAndroid } = await import("~/lib/is-mobile");
    expect(isAndroid()).toBe(false);
  });
});
