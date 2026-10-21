import { cn } from "~/lib/utils";

const SEGMENT_MIN_H = "min-h-9";

const COLS = {
  2: "grid-cols-2",
  3: "grid-cols-3",
} as const;

export interface RailSegmentedTabItem {
  id: string;
  label: string;
  ariaLabel: string;
}

export function RailSegmentedTabGroup({
  items,
  value,
  onValueChange,
  columns,
  radiogroupAriaLabel,
  disabled = false,
}: {
  items: RailSegmentedTabItem[];
  value: string;
  onValueChange: (next: string) => void;
  columns: 2 | 3;
  radiogroupAriaLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="border-border-subtle/65 bg-section/65 dark:bg-section/45 shrink-0 border-b px-3 pt-3 pb-2.5">
      <div
        role="radiogroup"
        aria-label={radiogroupAriaLabel}
        className={cn("grid gap-1", COLS[columns])}
      >
        {items.map((item) => {
          const active = value === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={item.ariaLabel}
              disabled={disabled}
              className={cn(
                SEGMENT_MIN_H,
                "motion-fast flex items-center justify-center rounded-md px-1 text-center text-xs",
                disabled && "pointer-events-none opacity-90",
                active
                  ? "bg-surface text-text ring-border-subtle/55 dark:ring-border-subtle/40 font-semibold shadow-sm ring-1 dark:shadow-none"
                  : "text-text-secondary hover:bg-surface-hover/55 hover:text-text border border-transparent font-medium"
              )}
              onClick={() => {
                if (!disabled) onValueChange(item.id);
              }}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
