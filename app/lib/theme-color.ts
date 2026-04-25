/**
 * Canvas-aligned browser/PWA chrome (`theme-color`) — keep in sync with
 * `tailwind.css` `--canvas`.
 *
 * This module is intentionally NOT `.client.ts` so the constant is available
 * during SSR (the root `meta()` and inline boot script reference it).
 */
export const THEME_COLOR_HEX = {
  /** Matches `tailwind.css` `--canvas` (= `--bg-base`, warm cream). */
  light: "#f7f6f4",
  /** Matches `tailwind.css` `--canvas` (= `--bg-base`, neutral charcoal). */
  dark: "#151618",
} as const;
