import {
  useFetcher,
  useRevalidator,
  useRouteLoaderData,
} from "@remix-run/react";
import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import {
  applyThemePreferenceToDocument,
  setStoredThemePreference,
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

  const fetcher = useFetcher<{ success?: boolean; error?: string }>();
  const revalidator = useRevalidator();
  const revalidatorRef = useRef(revalidator);
  useEffect(() => {
    revalidatorRef.current = revalidator;
  }, [revalidator]);

  useEffect(() => {
    if (fetcher.data?.success) {
      revalidatorRef.current.revalidate();
    }
  }, [fetcher.data?.success]);

  useEffect(() => {
    if (user?.id == null) return;
    setStoredThemePreference(accountTheme);
    setStored(accountTheme);
  }, [user?.id, accountTheme, setStored]);

  const pendingTheme =
    fetcher.state === "submitting"
      ? fetcher.formData?.get("themePreference")
      : null;
  const pendingOk =
    pendingTheme === "system" ||
    pendingTheme === "light" ||
    pendingTheme === "dark";

  const theme: StoredThemePreference = user
    ? pendingOk
      ? pendingTheme
      : accountTheme
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
    setStoredThemePreference(next);
    applyThemePreferenceToDocument(next);
    setStored(next);
    if (user) {
      const formData = new FormData();
      formData.append("_action", "update_theme_preference");
      formData.append("themePreference", next);
      fetcher.submit(formData, {
        method: "post",
        action: "/dashboard/settings",
      });
    }
  };

  const label = useMemo(() => themeAriaLabel(theme), [theme]);

  const Icon = theme === "system" ? Laptop : theme === "light" ? Sun : Moon;

  const placeholderTheme = !mounted && user ? accountTheme : theme;
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
