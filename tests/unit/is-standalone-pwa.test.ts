/**
 * @vitest-environment jsdom
 * Unit tests for isStandalonePWA detection
 * Tests app/lib/is-standalone-pwa.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("isStandalonePWA", () => {
  let originalWindow: typeof window;
  let originalNavigator: typeof navigator;

  beforeEach(() => {
    vi.clearAllMocks();
    originalWindow = globalThis.window;
    originalNavigator = globalThis.navigator;
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
    vi.resetModules();
  });

  it("returns false when matchMedia and standalone are not set", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        matchMedia: vi.fn(() => ({ matches: false })),
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });
    const { isStandalonePWA } = await import("~/lib/is-standalone-pwa");
    expect(isStandalonePWA()).toBe(false);
  });

  it("returns true when display-mode is standalone", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        matchMedia: vi.fn((query: string) => ({
          matches: query === "(display-mode: standalone)",
        })),
      },
      writable: true,
      configurable: true,
    });
    const { isStandalonePWA } = await import("~/lib/is-standalone-pwa");
    expect(isStandalonePWA()).toBe(true);
  });

  it("returns false when display-mode is not standalone", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        matchMedia: vi.fn(() => ({ matches: false })),
        navigator: {},
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      writable: true,
      configurable: true,
    });
    const { isStandalonePWA } = await import("~/lib/is-standalone-pwa");
    expect(isStandalonePWA()).toBe(false);
  });

  it("returns true when navigator.standalone is true (iOS)", async () => {
    Object.defineProperty(globalThis, "window", {
      value: {
        matchMedia: vi.fn(() => ({ matches: false })),
        navigator: { standalone: true },
      },
      writable: true,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: { standalone: true },
      writable: true,
      configurable: true,
    });
    const { isStandalonePWA } = await import("~/lib/is-standalone-pwa");
    expect(isStandalonePWA()).toBe(true);
  });
});
