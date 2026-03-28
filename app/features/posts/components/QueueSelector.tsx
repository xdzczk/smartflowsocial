import { Clock } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { railSelectTriggerClassNames } from "~/features/posts/components/publishing-rail";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { QueueType } from "../types";
interface QueueSelectorProps {
  queueTypes: Array<string | QueueType>;
  selectedQueue: string;
  onQueueChange: (queue: string) => void;
  disabled?: boolean;
  className?: string;
  /** When slot-based queue is selected, show e.g. "Next: Sat 18:00" */
  nextSlot?: string;
}

export function QueueSelector({
  queueTypes,
  selectedQueue,
  onQueueChange,
  disabled = false,
  className = "",
  nextSlot,
}: QueueSelectorProps) {
  const getQueueTypeId = (queueName: string): string => {
    const selectedQueueType = queueTypes.find((qt) =>
      typeof qt === "string" ? qt === queueName : qt.name === queueName
    );
    return typeof selectedQueueType === "object"
      ? selectedQueueType.id || ""
      : "";
  };

  return (
    <div className={className}>
      <Select
        value={
          selectedQueue === "unassigned" ? "__unassigned__" : selectedQueue
        }
        onValueChange={(value) =>
          onQueueChange(value === "__unassigned__" ? "unassigned" : value)
        }
        disabled={disabled}
      >
        <SelectTrigger
          id="queue-type-select"
          className={cn("w-full", railSelectTriggerClassNames)}
          aria-label="Select queue"
        >
          <SelectValue placeholder="Choose a queue" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__unassigned__">Select queue</SelectItem>
          {queueTypes
            .filter((queue) => {
              const queueName = typeof queue === "string" ? queue : queue.name;
              const isEnabled =
                typeof queue === "object" ? queue.isEnabled !== false : true;
              return isEnabled && queueName !== "Unassigned";
            })
            .map((queue) => {
              const queueName = typeof queue === "string" ? queue : queue.name;
              return (
                <SelectItem key={queueName} value={queueName}>
                  {queueName}
                </SelectItem>
              );
            })}
        </SelectContent>
      </Select>
      {nextSlot ? (
        <p className="text-foreground mt-1.5 flex items-center gap-1.5 text-xs font-medium">
          <Clock
            className="text-muted-foreground h-3.5 w-3.5 shrink-0"
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
          Next: {nextSlot}
        </p>
      ) : null}
      <input
        type="hidden"
        id="queue-type-hidden"
        name="queueType"
        value={selectedQueue}
      />
      <input
        type="hidden"
        id="queue-type-id-hidden"
        name="queueTypeId"
        value={getQueueTypeId(selectedQueue)}
      />
    </div>
  );
}
