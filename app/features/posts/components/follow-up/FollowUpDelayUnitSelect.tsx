import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { railSelectTriggerClassNames } from "~/features/posts/components/publishing-rail";
import type { DelayAfterMain } from "~/features/posts/utils/delay-after-main";
import { cn } from "~/lib/utils";

export function FollowUpDelayUnitSelect({
  value,
  onValueChange,
  disabled,
  id,
  triggerClassName,
}: {
  value: DelayAfterMain["unit"];
  onValueChange: (unit: DelayAfterMain["unit"]) => void;
  disabled?: boolean;
  id?: string;
  triggerClassName?: string;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as DelayAfterMain["unit"])}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={cn(
          "h-9 w-[5.5rem] shrink-0 px-2 text-xs",
          railSelectTriggerClassNames,
          triggerClassName
        )}
        aria-label="Hours or minutes"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="hours">hours</SelectItem>
        <SelectItem value="minutes">minutes</SelectItem>
      </SelectContent>
    </Select>
  );
}
