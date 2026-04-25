/**
 * Shared surfaces for sidebar utility cards — one step above the nav rail.
 * Light: plan = white + hairline + soft lift; install = quieter tint on the rail.
 * Dark: plan = overlay tier; install = softer overlay (subordinate to plan).
 */
export const SIDEBAR_UTILITY_CARD_CLASS =
  "rounded-md border border-border-subtle/46 bg-surface px-2.5 py-1.5 shadow-1 dark:border-border-subtle/20 dark:bg-surface-overlay dark:shadow-none";

/** PWA install — visually subordinate to plan usage (lighter, flatter than plan card). */
export const SIDEBAR_UTILITY_INSTALL_CARD_CLASS =
  "rounded border border-border-subtle/34 bg-surface-hover/32 px-1.5 py-0.5 shadow-none dark:border-border-subtle/14 dark:bg-surface-overlay/78 dark:shadow-none";
