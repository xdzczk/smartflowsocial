import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

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
        className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border"
        aria-label="Toggle theme"
        type="button"
      >
        <Sun className="h-4 w-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      type="button"
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <Sun className="h-4 w-4" />
      )}
    </button>
  );
}
