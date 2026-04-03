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
      role="radiogroup"
      aria-label={radiogroupAriaLabel}
      className={cn(
        "relative grid divide-x",
        /* Light: standard borders; dark: higher-contrast dividers so segments read as separate controls */
        "divide-border/75 border-border/75 border-b",
        "dark:divide-white/16 dark:border-b-white/16",
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
              active
                ? "text-foreground bg-muted/40 relative z-[1] font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20 font-medium"
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
  );
}
