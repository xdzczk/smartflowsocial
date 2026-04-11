import type { QueueType } from "~/features/posts/types";
import { cn } from "~/lib/utils";

export interface QueueSelectorProps {
  id: string;
  value: string;
  onChange: (queueTypeId: string) => void;
  queueTypes: QueueType[];
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
}

export function QueueSelector({
  id,
  value,
  onChange,
  queueTypes,
  className,
  labelClassName,
  selectClassName,
}: QueueSelectorProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-foreground block text-sm font-medium",
          labelClassName
        )}
      >
        Queue
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "border-border bg-background text-foreground focus:border-primary focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2",
          selectClassName
        )}
      >
        <option value="">Manual (No Queue)</option>
        {queueTypes.map((q) => (
          <option key={q.id} value={q.id}>
            {q.name}
          </option>
        ))}
      </select>
    </div>
  );
}
