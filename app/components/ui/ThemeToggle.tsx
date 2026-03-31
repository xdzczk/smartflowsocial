import { Laptop, Moon, Sun } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import {
  applyThemePreferenceToDocument,
  setStoredThemePreference,
  type StoredThemePreference,
} from "~/lib/theme.client";
import useLocalStorage from "~/lib/useLocalStorage";

export function ThemeToggle() {
  const [theme, setTheme] = useLocalStorage<StoredThemePreference>(
    "theme",
    "system"
  );
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
    setTheme(next);
    setStoredThemePreference(next);
  };

  const label = useMemo(() => {
    if (theme === "system") return "Theme: System";
    if (theme === "light") return "Theme: Light";
    return "Theme: Dark";
  }, [theme]);

  const Icon = theme === "system" ? Laptop : theme === "light" ? Sun : Moon;

  if (!mounted) {
    return (
      <button
        className="border-input bg-background hover:bg-muted focus:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
        aria-label="Theme: System"
        type="button"
      >
        <Laptop className={INLINE_ICON_SIZE_CLASS} />
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
