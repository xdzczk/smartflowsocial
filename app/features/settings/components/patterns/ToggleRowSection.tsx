import { cn } from "~/lib/utils";

export interface ToggleRowSectionProps {
  label: string;
  description?: string;
  /** Toggle control (e.g. Switch), right-aligned on wide screens. */
  control: React.ReactNode;
  /** Optional content below the row when expanded (e.g. sub-options). */
  children?: React.ReactNode;
  /** `bordered` — default card-like row; `plain` — no border, for stacked rows with separators. */
  variant?: "bordered" | "plain";
  className?: string;
}

/**
 * Compact toggle row: label + description on the left, control on the right.
 */
export function ToggleRowSection({
  label,
  description,
  control,
  children,
  variant = "bordered",
  className,
}: ToggleRowSectionProps) {
  return (
    <div
      className={cn(
        variant === "bordered" &&
          "border-border/60 space-y-3 rounded-lg border px-3 py-3 sm:px-4",
        variant === "plain" && "space-y-3 py-3 first:pt-0 last:pb-0 sm:py-3.5",
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{label}</p>
          {description ? (
            <p className="text-muted-foreground text-xs leading-snug">
              {description}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end sm:pl-4">{control}</div>
      </div>
      {children}
    </div>
  );
}
