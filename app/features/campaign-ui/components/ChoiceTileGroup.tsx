import type { ReactNode } from "react";

import { cn } from "~/lib/utils";

export interface ChoiceTileOption<T extends string = string> {
  value: T;
  title: string;
  description?: string;
  disabled?: boolean;
}

const tileBase = cn(
  "border-border bg-card cursor-pointer rounded-lg border p-4 transition-colors",
  "hover:border-primary/40",
  "focus-within:ring-ring focus-within:ring-1",
  "has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
);

const tileSelected = "border-primary bg-primary/5";

/**
 * Single-select choice tiles (radio). Selected state uses border-primary, no glow ring.
 */
export function ChoiceTileGroup<T extends string>({
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
  options: ReadonlyArray<ChoiceTileOption<T>>;
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
          <p className="text-foreground font-medium">{opt.title}</p>
          {opt.description ? (
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
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
