/**
 * Shared layout tokens for in-app product surfaces.
 *
 * - `DashboardLayoutPage` applies `DASHBOARD_MAIN_BAND_CLASS` on the main scroll
 *   band for most routes (calendar is full-bleed). Child pages should use
 *   `PageContent` with `fluid` so horizontal padding is not doubled.
 * - Operational pages use the fluid shell (full width + shared horizontal padding).
 * - Use `PAGE_MAX_WIDTH_CLASS` only for intentionally narrow surfaces (e.g. some
 *   forms, marketing) or pass `constrained` to `PageContent`.
 * - Marketing / landing pages keep their own containers — do not reuse these
 *   tokens there.
 */

/** Tailwind `@theme` token — see `app/tailwind.css` (`--max-width-page`, 1400px). */
export const PAGE_MAX_WIDTH_CLASS = "max-w-page";

/** Horizontal padding aligned across library, settings chrome, dashboard band, and footer. */
export const PAGE_PAD_X_CLASS = "px-4 sm:px-6 lg:px-8";

/**
 * Fluid app content shell: full width with shared horizontal inset (no global max-width).
 * Use for dashboard main band, admin bodies, and any route that should use workspace width.
 */
export const PAGE_SHELL_FLUID_CLASS = `w-full min-w-0 ${PAGE_PAD_X_CLASS}`;

/**
 * Main content band inside `DashboardLayoutPage` (non-calendar routes): fluid width
 * + shared horizontal inset.
 */
export const DASHBOARD_MAIN_BAND_CLASS = PAGE_SHELL_FLUID_CLASS;

/** Nested banners/alerts that need the same horizontal inset as the main band. */
export const DASHBOARD_MAIN_BAND_FULL_WIDTH_CLASS = PAGE_SHELL_FLUID_CLASS;

/**
 * Nested under the dashboard band: follow parent width; do not repeat max-width /
 * horizontal padding.
 */
export const PAGE_INNER_FLUID_CLASS = "flex w-full min-w-0 flex-col";

/** Admin / dense bodies under the dashboard band. */
export const ADMIN_PAGE_BODY_CLASS = `${PAGE_SHELL_FLUID_CLASS} py-6`;
