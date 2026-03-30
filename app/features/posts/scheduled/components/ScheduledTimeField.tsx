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
}

export function ScheduledTimeField({
  id,
  label = "Scheduled time",
  valueDatetimeLocal,
  minDatetimeLocal,
  onChange,
  humanReadableLine,
  className,
}: ScheduledTimeFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="text-foreground block text-sm font-medium">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <CalendarDays
          className="text-muted-foreground h-4 w-4 shrink-0"
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
        <input
          id={id}
          type="datetime-local"
          value={valueDatetimeLocal}
          min={minDatetimeLocal}
          onChange={onChange}
          className="border-border bg-background text-foreground focus:border-primary focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm focus:ring-2"
        />
      </div>
      {humanReadableLine ? (
        <p className="text-muted-foreground text-xs">{humanReadableLine}</p>
      ) : null}
    </div>
  );
}
