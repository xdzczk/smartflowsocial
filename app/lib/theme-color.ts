/**
 * Canvas-aligned browser/PWA chrome (`theme-color`) — keep in sync with
 * `tailwind.css` `--canvas`.
 *
 * This module is intentionally NOT `.client.ts` so the constant is available
 * during SSR (the root `meta()` and inline boot script reference it).
 */
export const THEME_COLOR_HEX = {
  /** Matches `tailwind.css` `--canvas` (warm off-white). */
  light: "#f7f6f3",
  /** Matches `tailwind.css` `--canvas` (warm ink charcoal). */
  dark: "#111012",
} as const;
