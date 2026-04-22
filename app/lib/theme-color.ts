/**
 * Canvas-aligned browser/PWA chrome (`theme-color`) — keep in sync with
 * `tailwind.css` `--canvas`.
 *
 * This module is intentionally NOT `.client.ts` so the constant is available
 * during SSR (the root `meta()` and inline boot script reference it).
 */
export const THEME_COLOR_HEX = {
  light: "#f9f9f9",
  dark: "#0b0b0b",
} as const;
