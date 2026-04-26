import * as React from "react";

import { cn } from "~/lib/utils";

export interface SegmentedOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "onChange" | "children"
> {
  value: string;
  onChange: (next: string) => void;
  options: readonly SegmentedOption[];
  /** `compact` matches admin range / small cadence controls. */
  size?: "default" | "compact";
  /** Stretch segments equally on narrow viewports. */
  fullWidth?: boolean;
  /** Disable all segments (e.g. form disabled). */
  disabled?: boolean;
  /**
   * When false, inactive segments use transparent background until hover
   * (matches older recipient-pool tabs).
   */
  inactiveSurface?: boolean;
}

/**
 * Single-choice segmented control (radiogroup). Active segment uses selection
 * tokens — not `action-primary` (reserved for primary CTAs).
 */
export const SegmentedControl = React.forwardRef<
  HTMLDivElement,
  SegmentedControlProps
>(function SegmentedControl(
  {
    value,
    onChange,
    options,
    size = "default",
    fullWidth = false,
    disabled = false,
    inactiveSurface = true,
    className,
    id,
    "aria-label": ariaLabel,
    ...props
  },
  ref
) {
  const autoId = React.useId();
  const groupId = id ?? `segmented-${autoId}`;

  return (
    <div
      ref={ref}
      id={groupId}
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex flex-wrap items-stretch gap-1",
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        const isDisabled = Boolean(disabled || opt.disabled);
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            disabled={isDisabled}
            onClick={() => {
              if (!isDisabled && opt.value !== value) onChange(opt.value);
            }}
            className={cn(
              "focus-ring motion-fast rounded-md font-medium disabled:pointer-events-none disabled:opacity-50",
              size === "compact"
                ? "min-h-0 px-2 py-1 text-xs"
                : "px-3 py-1.5 text-sm",
              fullWidth && "min-w-0 flex-1",
              isActive
                ? "bg-selection-fill text-selection-foreground hover:bg-selection-fill/90"
                : inactiveSurface
                  ? "bg-surface-hover text-text-secondary hover:bg-surface-hover/80 hover:text-text"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text bg-transparent"
            )}
          >
            <span className="block truncate text-center">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
});
SegmentedControl.displayName = "SegmentedControl";
