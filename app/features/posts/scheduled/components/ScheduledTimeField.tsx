import { CalendarDays } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

export interface ScheduledTimeFieldProps {
  id: string;
  label?: string;
  valueDatetimeLocal: string;
  minDatetimeLocal: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  humanReadableLine: string | null;
  className?: string;
  emphasis?: "default" | "primary";
}

export function ScheduledTimeField({
  id,
  label = "Scheduled time",
  valueDatetimeLocal,
  minDatetimeLocal,
  onChange,
  humanReadableLine,
  className,
  emphasis = "default",
}: ScheduledTimeFieldProps) {
  return (
    <div
      className={cn(
        "space-y-2",
        emphasis === "primary" &&
          "bg-surface-hover/20 border-border/70 rounded-xl border p-4",
        className
      )}
    >
      <label
        htmlFor={id}
        className={cn(
          "text-text block text-sm font-medium",
          emphasis === "primary" && "text-base"
        )}
      >
        {label}
      </label>
      <div className="cluster">
        <CalendarDays
          className="text-text-secondary h-4 w-4 shrink-0"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        <input
          id={id}
          type="datetime-local"
          value={valueDatetimeLocal}
          min={minDatetimeLocal}
          onChange={onChange}
          className="focus-ring border-border bg-canvas text-text focus:border-brand flex-1 rounded-md border px-3 py-2 text-sm"
        />
      </div>
      {humanReadableLine ? (
        <p
          className={cn(
            "text-text-secondary text-xs",
            emphasis === "primary" && "text-text text-sm font-medium"
          )}
        >
          {humanReadableLine}
        </p>
      ) : null}
    </div>
  );
}
