import type { ReactNode } from "react";

import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import { RAIL_SETTINGS_ROW } from "./tokens";

/** Label + trailing control (e.g. Switch)  -  right column aligns across rows */
export function RailSettingsRow({
  label,
  labelFor,
  control,
  helperText,
  className,
}: {
  label: ReactNode;
  labelFor?: string;
  control: ReactNode;
  helperText?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className={cn(RAIL_SETTINGS_ROW, "justify-between")}>
        <Label
          htmlFor={labelFor}
          className={cn(
            "text-text text-xs leading-none font-medium",
            labelFor && "cursor-pointer"
          )}
        >
          {label}
        </Label>
        <div className="flex shrink-0 items-center">{control}</div>
      </div>
      {helperText ? (
        <p className="text-text-secondary text-[10px] leading-snug">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

/** Collapsible / value row: label | value (truncate) | chevron */
export function RailSettingsValueRow({
  label,
  value,
  trailing,
  onClick,
  ariaExpanded,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  trailing: ReactNode;
  onClick?: () => void;
  ariaExpanded?: boolean;
  className?: string;
}) {
  const inner = (
    <>
      <span className="text-text w-24 shrink-0 text-xs font-medium">
        {label}
      </span>
      <span className="text-text-secondary min-w-0 flex-1 truncate text-right text-xs">
        {value}
      </span>
      <span className="flex shrink-0 items-center">{trailing}</span>
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={cn(
          RAIL_SETTINGS_ROW,
          "hover:bg-surface-hover/60 motion-fast w-full cursor-pointer rounded-sm text-left",
          className
        )}
        onClick={onClick}
        aria-expanded={ariaExpanded}
      >
        {inner}
      </button>
    );
  }

  return <div className={cn(RAIL_SETTINGS_ROW, className)}>{inner}</div>;
}
