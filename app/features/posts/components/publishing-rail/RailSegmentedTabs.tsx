import type { ComposerPublishMode } from "~/features/posts/composer/components/composer";
import { cn } from "~/lib/utils";

const TAB_ROW_H = "h-10";

export function RailSegmentedTabs({
  value,
  onValueChange,
}: {
  value: ComposerPublishMode;
  onValueChange: (next: ComposerPublishMode) => void;
}) {
  const modes: ComposerPublishMode[] = ["now", "schedule", "queue"];
  const labels: Record<ComposerPublishMode, string> = {
    now: "Now",
    schedule: "Schedule",
    queue: "Queue",
  };
  const ariaLabels: Record<ComposerPublishMode, string> = {
    now: "Publish now, immediate",
    schedule: "Schedule for a specific time",
    queue: "Add to queue",
  };

  return (
    <div
      role="radiogroup"
      aria-label="Publishing mode"
      className="border-border/60 relative grid grid-cols-3 border-b"
    >
      {modes.map((m) => {
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ariaLabels[m]}
            className={cn(
              TAB_ROW_H,
              "border-border/50 flex items-center justify-center border-e px-1 text-center text-xs transition-colors last:border-e-0",
              active
                ? "text-foreground bg-muted/40 border-b-card relative z-[1] -mb-px border-b font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/20 border-b border-transparent font-medium"
            )}
            onClick={() => onValueChange(m)}
          >
            {labels[m]}
          </button>
        );
      })}
    </div>
  );
}
