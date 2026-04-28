import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export interface ChoiceTileOption<T extends string = string> {
  value: T;
  title: string;
  description?: string;
  disabled?: boolean;
}

const tileBase = cn(
  "border-border bg-surface shadow-1 cursor-pointer rounded-xl border motion-fast",
  "hover:border-selection-border/40 hover:bg-surface-hover/25",
  "focus-within:ring-2 focus-within:ring-focus-ring",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
);

const tileSelected =
  "border-selection-border bg-selection-wash ring-selection-border/35 ring-2";

/**
 * Single-select choice tiles (radio). Selected state uses selection tokens.
 */
export function ChoiceTileGroup<T extends string>({
  name,
  value,
  onChange,
  options,
  className,
  columnsClassName = "grid gap-3 sm:grid-cols-2",
  compact = false,
}: {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<ChoiceTileOption<T>>;
  className?: string;
  columnsClassName?: string;
  /** Slightly shorter tiles (campaign source mode). */
  compact?: boolean;
}) {
  return (
    <div className={cn(columnsClassName, className)} role="radiogroup">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            tileBase,
            compact ? "p-3" : "p-4",
            value === opt.value ? tileSelected : "",
            opt.disabled ? "pointer-events-none" : ""
          )}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={opt.disabled}
            onChange={() => {
              if (!opt.disabled) onChange(opt.value);
            }}
            className="sr-only"
          />
          <p
            className={cn(
              "text-text font-medium",
              compact && "text-sm leading-snug"
            )}
          >
            {opt.title}
          </p>
          {opt.description ? (
            <p
              className={cn(
                "text-text-secondary leading-snug",
                compact ? "mt-0.5 text-xs" : "mt-1 text-sm"
              )}
            >
              {opt.description}
            </p>
          ) : null}
        </label>
      ))}
    </div>
  );
}

/**
 * Choice tiles where each option renders custom children (still one selected).
 */
export function ChoiceTileGroupCustom<T extends string>({
  name,
  value,
  onChange,
  options,
  className,
  columnsClassName = "grid gap-3 sm:grid-cols-2",
}: {
  name: string;
  value: T;
  onChange: (next: T) => void;
  options: ReadonlyArray<{
    value: T;
    disabled?: boolean;
    children: ReactNode;
  }>;
  className?: string;
  columnsClassName?: string;
}) {
  return (
    <div className={cn(columnsClassName, className)} role="radiogroup">
      {options.map((opt) => (
        <label
          key={opt.value}
          className={cn(
            tileBase,
            "p-4",
            value === opt.value ? tileSelected : "",
            opt.disabled ? "pointer-events-none opacity-60" : ""
          )}
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            disabled={opt.disabled}
            onChange={() => {
              if (!opt.disabled) onChange(opt.value);
            }}
            className="sr-only"
          />
          {opt.children}
        </label>
      ))}
    </div>
  );
}
