/**
 * Shared surfaces for sidebar utility cards — silent hierarchy (no section labels).
 * Plan usage = slightly stronger border/fill; install = lighter secondary read.
 */
export const SIDEBAR_UTILITY_CARD_CLASS =
  "rounded-md border border-border-strong/45 bg-surface-hover/45 px-2.5 py-1.5 shadow-none dark:border-border-subtle dark:bg-surface-hover/38";

/** PWA install — visually subordinate to plan usage (lighter, flatter than plan card). */
export const SIDEBAR_UTILITY_INSTALL_CARD_CLASS =
  "rounded border border-border-subtle/55 bg-surface-hover/14 px-1.5 py-0.5 shadow-none dark:border-border-subtle/35 dark:bg-surface-hover/10";
