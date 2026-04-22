import { cn } from "~/lib/utils";

const TAB_ROW_H = "h-10";

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
    <div
      className={cn(
        // rounded-t-lg (14px) matches the rail body's rounded-lg below.
        "overflow-hidden rounded-t-lg border-x border-t",
        /* Strengthened global --border (14% in dark) reads on both modes — no override needed. */
        "border-border-strong"
      )}
    >
      <div
        role="radiogroup"
        aria-label={radiogroupAriaLabel}
        className={cn("divide-border relative grid divide-x", COLS[columns])}
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
                TAB_ROW_H,
                "motion-fast flex items-center justify-center px-1 text-center text-xs",
                disabled && "pointer-events-none opacity-90",
                /* Active: no bottom rule so it reads as one surface with the rail body below */
                active
                  ? "bg-surface text-text relative z-[1] border-b border-b-transparent font-semibold"
                  : "bg-surface-hover/40 text-text-secondary border-border hover:bg-surface-hover/70 hover:text-text border-b font-medium"
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
