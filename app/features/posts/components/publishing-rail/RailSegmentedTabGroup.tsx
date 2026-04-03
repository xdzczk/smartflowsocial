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
        "overflow-hidden rounded-t-xl border-x border-t",
        /* Frame the mode strip; dark needs stronger edge vs canvas */
        "border-border/85 dark:border-white/20"
      )}
    >
      <div
        role="radiogroup"
        aria-label={radiogroupAriaLabel}
        className={cn(
          "relative grid divide-x",
          "divide-border/80 dark:divide-white/18",
          COLS[columns]
        )}
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
                "flex items-center justify-center px-1 text-center text-xs transition-colors",
                disabled && "pointer-events-none opacity-90",
                /* Active: no bottom rule so it reads as one surface with the rail body below */
                active
                  ? "bg-card text-foreground relative z-[1] border-b border-b-transparent font-semibold"
                  : "bg-muted/30 text-muted-foreground border-border/85 hover:bg-muted/45 hover:text-foreground border-b font-medium dark:border-b-white/18 dark:bg-white/[0.05]"
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
