/**
 * Canvas-aligned browser/PWA chrome (`theme-color`) — keep in sync with
 * `tailwind.css` `--canvas`.
 *
 * This module is intentionally NOT `.client.ts` so the constant is available
 * during SSR (the root `meta()` and inline boot script reference it).
 */
export const THEME_COLOR_HEX = {
  /** Matches `tailwind.css` `--canvas` (= `--bg-app`, hsl(240 20% 96%)). */
  light: "#f3f3f7",
  /** Matches `tailwind.css` `--canvas` (= `--bg-app`, hsl(240 10% 8%)). */
  dark: "#121216",
} as const;
