/**
 * Shared surfaces for sidebar utility cards — silent hierarchy (no section labels).
 * Plan usage = slightly stronger border/fill; install = lighter secondary read.
 */
export const SIDEBAR_UTILITY_CARD_CLASS =
  "rounded-md border border-border-subtle/80 bg-surface-hover/28 px-2.5 py-1.5 shadow-none dark:border-border-subtle/75 dark:bg-surface-hover/22";

/** PWA install — visually subordinate to plan usage (lighter, flatter than plan card). */
export const SIDEBAR_UTILITY_INSTALL_CARD_CLASS =
  "rounded border border-border-subtle/45 bg-surface-hover/10 px-1.5 py-0.5 shadow-none dark:border-border-subtle/30 dark:bg-surface-hover/8";
