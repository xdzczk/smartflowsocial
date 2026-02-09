import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { INLINE_ICON_SIZE_CLASS } from "~/lib/icon-constants";
import useLocalStorage from "~/lib/useLocalStorage";

export function ThemeToggle() {
  // Default to dark mode, but will be overridden by system preference or stored value
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("theme", "dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Check if theme was already set by the inline script in root.tsx
    const currentTheme = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    if (currentTheme !== theme) {
      setTheme(currentTheme);
    }
    // Use setTimeout to defer setState, avoiding synchronous setState in effect
    if (!mounted) {
      const timeoutId = setTimeout(() => {
        setMounted(true);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [setTheme, theme, mounted]);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);

    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  if (!mounted) {
    return (
      <button
        className="border-input bg-background hover:bg-muted focus:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border focus:ring-2 focus:outline-none"
        aria-label="Toggle theme"
        type="button"
      >
        <Sun className={INLINE_ICON_SIZE_CLASS} />
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={toggleTheme}
          className="border-input bg-background hover:bg-muted focus:ring-ring inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors focus:ring-2 focus:outline-none"
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          type="button"
        >
          {theme === "light" ? (
            <Moon className={INLINE_ICON_SIZE_CLASS} />
          ) : (
            <Sun className={INLINE_ICON_SIZE_CLASS} />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Switch to {theme === "light" ? "dark" : "light"} mode</p>
      </TooltipContent>
    </Tooltip>
  );
}
