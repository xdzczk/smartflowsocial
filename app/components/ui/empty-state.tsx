/**
 * EmptyState — canonical "no data, here's what to do next" primitive.
 *
 * Phase 1i. Before this primitive, the codebase had ~15 ad-hoc inline empty
 * states that all rendered the same shape (an icon, a heading, a body line,
 * sometimes a CTA) with slightly different sizes, colors, and spacings. This
 * primitive collapses them into a single API:
 *
 *   <EmptyState
 *     icon={<FileText />}
 *     title="No drafts yet"
 *     description="Create your first draft to see it here."
 *     action={<Button>New draft</Button>}
 *     secondaryAction={<Button variant="ghost">Import</Button>}
 *   />
 *
 * Three sizes:
 *
 *   size "sm" — tight inline empty state for narrow panels and dropdown
 *               menus. ~py-6, smaller icon, body text.
 *   size "md" — default. Sits inside a card or section. ~py-12.
 *   size "lg" — full-page empty state. Hero icon, generous spacing. ~py-20.
 *
 * The icon prop accepts any ReactNode — typically a Lucide icon. The
 * primitive sizes the icon container; the icon itself inherits the size
 * via the `[&_svg]:size-N` selector so callers don't need to set a size
 * class on the icon. For decorative-only icons, omit `iconLabel`. For
 * icons that carry meaning (rare in empty states), pass `iconLabel`.
 *
 * `action` is the primary CTA — usually a Button. `secondaryAction` is
 * optional. They render side-by-side; on narrow viewports they wrap.
 */
import * as React from "react";

import { cn } from "~/lib/utils";

export type EmptyStateSize = "sm" | "md" | "lg";

const SIZE_PADDING: Record<EmptyStateSize, string> = {
  sm: "px-3 py-6",
  md: "px-4 py-12",
  lg: "px-6 py-20",
};

const SIZE_ICON: Record<EmptyStateSize, string> = {
  sm: "[&_svg]:size-6",
  md: "[&_svg]:size-10",
  lg: "[&_svg]:size-14",
};

const SIZE_TITLE: Record<EmptyStateSize, string> = {
  sm: "text-sm font-medium",
  md: "text-base font-semibold",
  lg: "text-lg font-semibold",
};

const SIZE_DESCRIPTION: Record<EmptyStateSize, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-sm",
};

const SIZE_GAP: Record<EmptyStateSize, string> = {
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
};

const SIZE_DESCRIPTION_MAX_WIDTH: Record<EmptyStateSize, string> = {
  sm: "max-w-xs",
  md: "max-w-sm",
  lg: "max-w-md",
};

export interface EmptyStateProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> {
  /** Decorative or meaningful icon (typically a Lucide glyph). */
  icon?: React.ReactNode;
  /** Optional accessible label for the icon when it conveys meaning. */
  iconLabel?: string;
  /** Headline. Required — communicates what's missing. */
  title: React.ReactNode;
  /** Optional supporting copy. */
  description?: React.ReactNode;
  /** Primary CTA, typically a <Button>. */
  action?: React.ReactNode;
  /** Optional secondary CTA. */
  secondaryAction?: React.ReactNode;
  /** Visual size step. Defaults to "md". */
  size?: EmptyStateSize;
}

const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  (
    {
      icon,
      iconLabel,
      title,
      description,
      action,
      secondaryAction,
      size = "md",
      className,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          "text-text-secondary flex flex-col items-center justify-center text-center",
          SIZE_PADDING[size],
          SIZE_GAP[size],
          className
        )}
        {...props}
      >
        {icon ? (
          <div
            className={cn("text-text-secondary/80", SIZE_ICON[size])}
            role={iconLabel ? "img" : undefined}
            aria-label={iconLabel}
            aria-hidden={iconLabel ? undefined : true}
          >
            {icon}
          </div>
        ) : null}
        <h2 className={cn("text-text", SIZE_TITLE[size])}>{title}</h2>
        {description ? (
          <p
            className={cn(
              "leading-relaxed",
              SIZE_DESCRIPTION[size],
              SIZE_DESCRIPTION_MAX_WIDTH[size]
            )}
          >
            {description}
          </p>
        ) : null}
        {action || secondaryAction ? (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            {action}
            {secondaryAction}
          </div>
        ) : null}
      </div>
    );
  }
);
EmptyState.displayName = "EmptyState";

export { EmptyState };
