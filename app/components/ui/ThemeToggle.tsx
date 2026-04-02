import { useRouteLoaderData } from "@remix-run/react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import {
  applyThemePreferenceToDocument,
  getSessionThemeOverride,
  notifyThemeSessionChanged,
  setSessionThemeOverride,
  setStoredThemePreference,
  subscribeThemeSessionChanged,
  type StoredThemePreference,
} from "~/lib/theme.client";
import useLocalStorage from "~/lib/useLocalStorage";

type RootLoaderUser =
  | {
      id: string;
      themePreference?: string | null;
    }
  | null
  | undefined;

function normalizeAccountTheme(user: RootLoaderUser): StoredThemePreference {
  if (!user) return "system";
  const t = user.themePreference;
  if (t === "system" || t === "light" || t === "dark") return t;
  return "system";
}

function themeAriaLabel(preference: StoredThemePreference): string {
  if (preference === "system") return "Theme: System";
  if (preference === "light") return "Theme: Light";
  return "Theme: Dark";
}

function readSessionSnapshot(): StoredThemePreference | null {
  return getSessionThemeOverride();
}

export function ThemeToggle() {
  const rootData = useRouteLoaderData("root") as
    | { user?: RootLoaderUser }
    | undefined;
  const user = rootData?.user ?? null;
  const accountTheme = useMemo(() => normalizeAccountTheme(user), [user]);

  const [stored, setStored] = useLocalStorage<StoredThemePreference>(
    "theme",
    "system"
  );

  const sessionOverride = useSyncExternalStore(
    subscribeThemeSessionChanged,
    readSessionSnapshot,
    () => null
  );

  const theme: StoredThemePreference = user
    ? (sessionOverride ?? accountTheme)
    : stored;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    applyThemePreferenceToDocument(theme);
  }, [theme]);

  const cycleTheme = () => {
    const next: StoredThemePreference =
      theme === "system" ? "light" : theme === "light" ? "dark" : "system";
    if (user) {
      setSessionThemeOverride(next);
      notifyThemeSessionChanged();
    } else {
      setStoredThemePreference(next);
      setStored(next);
    }
    applyThemePreferenceToDocument(next);
  };

  const label = useMemo(() => themeAriaLabel(theme), [theme]);

  const Icon = theme === "system" ? Laptop : theme === "light" ? Sun : Moon;

  const placeholderTheme = (() => {
    if (!user) return theme;
    if (typeof window !== "undefined") {
      return getSessionThemeOverride() ?? accountTheme;
    }
    return accountTheme;
  })();
  const PlaceholderIcon =
    placeholderTheme === "system"
      ? Laptop
      : placeholderTheme === "light"
        ? Sun
        : Moon;

  if (!mounted) {
    return (
      <button
        className="border-input bg-background hover:bg-muted focus:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
        aria-label={user ? themeAriaLabel(placeholderTheme) : "Theme: System"}
        type="button"
      >
        <PlaceholderIcon className={INLINE_ICON_SIZE_CLASS} />
      </button>
    );
  }

  return (
    <button
      onClick={cycleTheme}
      className="border-input bg-background hover:bg-muted focus:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus:ring-2 focus:outline-none"
      aria-label={label}
      type="button"
    >
      <Icon className={INLINE_ICON_SIZE_CLASS} />
    </button>
  );
}
