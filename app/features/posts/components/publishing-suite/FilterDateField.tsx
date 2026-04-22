import { CalendarDays } from "lucide-react";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { cn } from "~/lib/utils";

import {
  PUBLISHING_FILTER_CONTROL_BASE_CLASS,
  PUBLISHING_FILTER_CONTROL_H,
  PUBLISHING_FILTER_CONTROL_RADIUS,
  PUBLISHING_FILTER_WIDTH_DATE,
} from "./constants";

export function FilterDateField({
  id,
  label,
  value,
  onValueChange,
  min,
  max,
  className,
  widthClassName,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (next: string) => void;
  min?: string;
  max?: string;
  className?: string;
  widthClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Label
        htmlFor={id}
        className="text-text-secondary text-xs font-medium whitespace-nowrap"
      >
        {label}
      </Label>
      <div className="relative">
        <CalendarDays
          className="text-text-secondary pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          min={min}
          max={max}
          className={cn(
            PUBLISHING_FILTER_CONTROL_H,
            PUBLISHING_FILTER_CONTROL_RADIUS,
            PUBLISHING_FILTER_CONTROL_BASE_CLASS,
            widthClassName ?? PUBLISHING_FILTER_WIDTH_DATE,
            "pl-9 text-sm font-medium"
          )}
        />
      </div>
    </div>
  );
}
