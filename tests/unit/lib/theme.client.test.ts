/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyEffectiveThemeToDocument,
  applyThemePreferenceToDocument,
  clearSessionThemeOverride,
  getSessionThemeOverride,
  getStoredThemePreference,
  getSystemEffectiveTheme,
  hasStoredThemePreference,
  notifyThemeSessionChanged,
  resolveEffectiveTheme,
  setSessionThemeOverride,
  setStoredThemePreference,
  subscribeThemeSessionChanged,
  subscribeToDocumentThemeChanges,
  subscribeToSystemThemeChanges,
} from "~/lib/theme.client";

describe("theme client", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.className = "";
  });

  it("reads and writes stored theme preferences", () => {
    expect(getStoredThemePreference()).toBeNull();
    expect(hasStoredThemePreference()).toBe(false);
    setStoredThemePreference("dark");
    expect(getStoredThemePreference()).toBe("dark");
    expect(hasStoredThemePreference()).toBe(true);
    window.localStorage.setItem("theme", "invalid");
    expect(getStoredThemePreference()).toBeNull();
  });

  it("handles session override lifecycle", () => {
    expect(getSessionThemeOverride()).toBeNull();
    setSessionThemeOverride("light");
    expect(getSessionThemeOverride()).toBe("light");
    clearSessionThemeOverride();
    expect(getSessionThemeOverride()).toBeNull();
  });

  it("notifies and subscribes theme session changes", () => {
    const onChange = vi.fn();
    const unsub = subscribeThemeSessionChanged(onChange);
    notifyThemeSessionChanged();
    expect(onChange).toHaveBeenCalledTimes(1);
    unsub();
    notifyThemeSessionChanged();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("resolves and applies effective themes", () => {
    expect(resolveEffectiveTheme("light")).toBe("light");
    expect(resolveEffectiveTheme("dark")).toBe("dark");
    applyEffectiveThemeToDocument("dark");
    expect(document.documentElement).toHaveClass("dark");
    applyEffectiveThemeToDocument("light");
    expect(document.documentElement).not.toHaveClass("dark");
  });

  it("reads system effective theme from matchMedia", () => {
    window.matchMedia = vi.fn(
      () =>
        ({
          matches: true,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList
    );
    expect(getSystemEffectiveTheme()).toBe("dark");
  });

  it("subscribes to system theme changes with modern and legacy listeners", () => {
    const onChange = vi.fn();
    let handler: (() => void) | undefined;
    window.matchMedia = vi.fn(
      () =>
        ({
          matches: false,
          addEventListener: (_event: string, cb: () => void) => {
            handler = cb;
          },
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList
    );
    const unsub = subscribeToSystemThemeChanges(onChange);
    handler?.();
    expect(onChange).toHaveBeenCalledWith("light");
    unsub();

    const addListener = vi.fn((cb: () => void) => cb());
    const removeListener = vi.fn();
    window.matchMedia = vi.fn(
      () =>
        ({
          matches: true,
          addListener,
          removeListener,
        }) as unknown as MediaQueryList
    );
    const unsubLegacy = subscribeToSystemThemeChanges(onChange);
    expect(addListener).toHaveBeenCalled();
    unsubLegacy();
    expect(removeListener).toHaveBeenCalled();
  });

  it("applies system preference and reacts to future changes", () => {
    const listeners: Array<() => void> = [];
    let matches = false;
    window.matchMedia = vi.fn(
      () =>
        ({
          get matches() {
            return matches;
          },
          addEventListener: (_event: string, cb: () => void) => {
            listeners.push(cb);
          },
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList
    );

    applyThemePreferenceToDocument("system");
    expect(document.documentElement).not.toHaveClass("dark");
    matches = true;
    listeners[0]?.();
    expect(document.documentElement).toHaveClass("dark");
  });

  it("subscribes to document theme class changes", async () => {
    const onChange = vi.fn();
    const unsub = subscribeToDocumentThemeChanges(onChange);
    expect(onChange).toHaveBeenCalledWith("light");
    document.documentElement.classList.add("dark");
    // MutationObserver callbacks fire asynchronously in jsdom.
    await Promise.resolve();
    expect(onChange).toHaveBeenCalledWith("dark");
    unsub();
  });
});
