import type { BulkBatchMode } from "~/features/posts/bulk-composer/types";
import { cn } from "~/lib/utils";

const TAB_ROW_H = "h-10";

const LABELS: Record<BulkBatchMode, string> = {
  schedule: "Schedule",
  queue: "Queue",
};

const ARIA_LABELS: Record<BulkBatchMode, string> = {
  schedule: "Schedule posts for specific times",
  queue: "Add posts to a queue",
};

/** Segmented tabs matching publish rail `RailSegmentedTabs` styling (Schedule / Queue only). */
export function BulkBatchModeTabs({
  value,
  onValueChange,
  disabled = false,
}: {
  value: BulkBatchMode;
  onValueChange: (next: BulkBatchMode) => void;
  disabled?: boolean;
}) {
  const modes = ["schedule", "queue"] as const;

  return (
    <div
      role="radiogroup"
      aria-label="Batch mode"
      className="divide-border/60 relative grid grid-cols-2 divide-x"
    >
      {modes.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ARIA_LABELS[m]}
            disabled={disabled}
            className={cn(
              TAB_ROW_H,
              "flex items-center justify-center px-1 text-center text-xs transition-colors",
              disabled && "pointer-events-none opacity-90",
              active
                ? "text-foreground bg-muted/40 relative z-[1] border-b border-b-transparent font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-border/60 border-b font-medium"
            )}
            onClick={() => {
              if (!disabled) onValueChange(m);
            }}
          >
            {LABELS[m]}
          </button>
        );
      })}
    </div>
  );
}
