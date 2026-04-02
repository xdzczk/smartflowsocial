export type StoredThemePreference = "system" | "light" | "dark";
export type EffectiveTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme" as const;

function safeParseStoredTheme(
  raw: string | null
): StoredThemePreference | null {
  if (!raw) return null;
  // Back-compat: previous values may be JSON-stringified.
  let v: unknown = raw;
  try {
    v = JSON.parse(raw);
  } catch {
    // ignore
  }
  if (v === "system" || v === "light" || v === "dark") return v;
  return null;
}

export function getStoredThemePreference(): StoredThemePreference | null {
  if (typeof window === "undefined") return null;
  return safeParseStoredTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
}

export function hasStoredThemePreference(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(THEME_STORAGE_KEY) != null;
}

export function setStoredThemePreference(value: StoredThemePreference): void {
  if (typeof window === "undefined") return;
  // Must match ThemeToggle's useLocalStorage, which reads via JSON.parse.
  window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(value));
}

export function getSystemEffectiveTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "dark";
  if (typeof window.matchMedia !== "function") return "light";
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  return mql.matches ? "dark" : "light";
}

export function resolveEffectiveTheme(
  preference: StoredThemePreference | null
): EffectiveTheme {
  if (preference === "light" || preference === "dark") return preference;
  return getSystemEffectiveTheme();
}

export function applyEffectiveThemeToDocument(theme: EffectiveTheme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

let unsubscribeSystem: (() => void) | null = null;

/**
 * Apply a stored preference to the document and (when `system`) keep it synced
 * to OS changes for the lifetime of the page.
 */
export function applyThemePreferenceToDocument(
  preference: StoredThemePreference
): void {
  const effective = resolveEffectiveTheme(preference);
  applyEffectiveThemeToDocument(effective);

  if (unsubscribeSystem) {
    unsubscribeSystem();
    unsubscribeSystem = null;
  }

  if (preference === "system") {
    unsubscribeSystem = subscribeToSystemThemeChanges((nextEffective) => {
      applyEffectiveThemeToDocument(nextEffective);
    });
  }
}

export function subscribeToSystemThemeChanges(
  onChange: (effectiveTheme: EffectiveTheme) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");

  const handler = () => onChange(mql.matches ? "dark" : "light");
  // Safari < 14 uses addListener/removeListener.
  if (typeof mql.addEventListener === "function") {
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }
  const legacy = mql as unknown as {
    addListener?: (cb: () => void) => void;
    removeListener?: (cb: () => void) => void;
  };
  legacy.addListener?.(handler);
  return () => legacy.removeListener?.(handler);
}

export function subscribeToDocumentThemeChanges(
  onChange: (effectiveTheme: EffectiveTheme) => void
): () => void {
  if (typeof document === "undefined") return () => {};
  const el = document.documentElement;

  const compute = (): EffectiveTheme =>
    el.classList.contains("dark") ? "dark" : "light";

  // Fire once so consumers don't need a separate initial read.
  onChange(compute());

  const observer = new MutationObserver(() => {
    onChange(compute());
  });
  observer.observe(el, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}
