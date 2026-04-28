import * as React from "react";

import { cn } from "~/lib/utils";

export interface FilterChipProps extends Omit<
  React.ComponentPropsWithoutRef<"button">,
  "children"
> {
  /** Selected / pressed filter state. */
  active?: boolean;
  children: React.ReactNode;
  /** Optional leading icon (inherit size via chip). */
  icon?: React.ReactNode;
  /** Optional trailing count or short badge (e.g. filter counts). */
  count?: React.ReactNode;
}

/**
 * Pill filter toggle: active uses selection tokens (not action-primary).
 * Inactive uses neutral surface + secondary text.
 */
const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  (
    {
      active = false,
      className,
      children,
      icon,
      count,
      disabled,
      type = "button",
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-pressed={active}
        className={cn(
          "focus-ring motion-fast inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium disabled:pointer-events-none disabled:opacity-50",
          active
            ? "bg-selection-fill text-selection-foreground hover:bg-selection-fill/90"
            : "bg-surface-hover text-text-secondary hover:bg-surface-hover/80 hover:text-text border-transparent",
          className
        )}
        {...props}
      >
        {icon ? (
          <span className="inline-flex shrink-0 [&_svg]:size-3.5 [&_svg]:text-current">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 truncate">{children}</span>
        {count != null && count !== "" ? (
          <span
            className={cn(
              "tabular-nums",
              active ? "text-selection-foreground/90" : "text-text-tertiary"
            )}
          >
            {count}
          </span>
        ) : null}
      </button>
    );
  }
);
FilterChip.displayName = "FilterChip";

export { FilterChip };
