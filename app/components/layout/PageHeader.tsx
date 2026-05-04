import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Product page title row variants. `marketing` is reserved for future public/marketing
 * shells (e.g. Plans); it currently matches `library`  -  do not force migration yet.
 */
export type PageHeaderVariant =
  | "library"
  | "compact"
  | "admin"
  | "dashboard"
  | "marketing";

/** Shared shell for library / dashboard / marketing title rows. */
const PAGE_HEADER_SHELL_LIBRARY_LIKE =
  "flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4";

const VARIANT_SHELL: Record<PageHeaderVariant, string> = {
  library: PAGE_HEADER_SHELL_LIBRARY_LIKE,
  compact:
    "flex flex-col gap-0.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3",
  admin:
    "border-border flex flex-col gap-3 border-b py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
  dashboard: PAGE_HEADER_SHELL_LIBRARY_LIKE,
  marketing: PAGE_HEADER_SHELL_LIBRARY_LIKE,
};

/** Shared title scale for library / admin / dashboard / marketing. */
const PAGE_HEADER_TITLE_H2 = "text-text text-h2";

const VARIANT_TITLE: Record<PageHeaderVariant, string> = {
  library: PAGE_HEADER_TITLE_H2,
  compact: "text-text text-h3",
  admin: PAGE_HEADER_TITLE_H2,
  dashboard: PAGE_HEADER_TITLE_H2,
  marketing: PAGE_HEADER_TITLE_H2,
};

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Secondary line(s) under subtitle (e.g. admin “Last updated”). */
  meta?: ReactNode;
  actions?: ReactNode;
  variant?: PageHeaderVariant;
  className?: string;
  /** Override default title typography (e.g. composer uses `text-h1`). */
  titleClassName?: string;
}

/**
 * Shared page title / subtitle / actions header for product surfaces (library,
 * compact tool pages, admin, dashboard sections). Marketing shells may adopt
 * `variant="marketing"` later without changing hierarchy.
 */
const LIBRARY_LIKE_VARIANTS: ReadonlySet<PageHeaderVariant> = new Set([
  "library",
  "dashboard",
  "marketing",
]);

export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  variant = "library",
  className,
  titleClassName,
}: PageHeaderProps) {
  /** Keep title + actions on one row on narrow viewports (composer save status, archive links, etc.). */
  const libraryLikeActionsRow =
    actions != null && LIBRARY_LIKE_VARIANTS.has(variant);

  /** With a single-line title row, center the action slot to the heading; with a subtitle, keep top alignment. */
  const libraryLikeActionsAlign = subtitle
    ? "items-start sm:items-start"
    : "items-center sm:items-center";

  return (
    <header
      className={cn(
        VARIANT_SHELL[variant],
        libraryLikeActionsRow &&
          cn(
            "flex-row justify-between gap-2 sm:gap-4",
            libraryLikeActionsAlign
          ),
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1">
        <h1 className={cn(VARIANT_TITLE[variant], titleClassName)}>{title}</h1>
        {subtitle ? (
          <p className="text-text-secondary max-w-2xl text-sm">{subtitle}</p>
        ) : null}
        {meta}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
