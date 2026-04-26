/**
 * Phase C5 — shared layout tokens for in-app product surfaces.
 *
 * - Dashboard routes: `DashboardLayoutPage` applies `DASHBOARD_MAIN_BAND_CLASS` on
 *   the main scroll band (except calendar + dashboard index + composer). Child
 *   pages should use `PageContent` with `fluid` so max-width / horizontal padding
 *   are not doubled.
 * - Standalone product pages (if any outside that shell) use `PageContent` default
 *   (`constrained`) for `max-w-page` + horizontal padding + default bottom rhythm.
 * - Marketing / landing pages (e.g. Plans) keep their own marketing container — do
 *   not reuse these tokens there.
 * - Full-bleed pages (calendar grid, composer shells) must opt out in the shell via
 *   `fullBleed` on `PageContent`, or by skipping `PageContent`, intentionally — never
 *   by omitting constraints on ordinary product pages.
 */

/** Tailwind `@theme` token — see `app/tailwind.css` (`--max-width-page`, 1400px). */
export const PAGE_MAX_WIDTH_CLASS = "max-w-page";

/** Horizontal padding aligned across library, settings, admin, and dashboard band. */
export const PAGE_PAD_X_CLASS = "px-4 sm:px-6 lg:px-8";

/**
 * Main content band inside `DashboardLayoutPage` (non-calendar, non-index product
 * routes): centered column + shared horizontal inset.
 */
export const DASHBOARD_MAIN_BAND_CLASS = `mx-auto w-full min-w-0 ${PAGE_MAX_WIDTH_CLASS} ${PAGE_PAD_X_CLASS}`;

/** Same max width + padding with `w-full` for nested banners. */
export const DASHBOARD_MAIN_BAND_FULL_WIDTH_CLASS = `mx-auto w-full min-w-0 ${PAGE_MAX_WIDTH_CLASS} ${PAGE_PAD_X_CLASS}`;

/**
 * Nested under the dashboard band: follow parent width; do not repeat max-width /
 * horizontal padding.
 */
export const PAGE_INNER_FLUID_CLASS = "flex w-full min-w-0 flex-col";

/** Admin / dense bodies under the dashboard band (replaces ad-hoc `max-w-6xl`). */
export const ADMIN_PAGE_BODY_CLASS = `mx-auto w-full ${PAGE_MAX_WIDTH_CLASS} ${PAGE_PAD_X_CLASS} py-6`;
