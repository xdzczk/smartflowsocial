import { Clock } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import { getDynamicQueueStyle, getQueueAccentHex } from "../queue-colors";
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
      <span
        id="queue-type-label"
        className="text-muted-foreground dark:text-foreground mb-2 block text-sm font-medium"
      >
        Queue Type
      </span>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby="queue-type-label"
      >
        {/* Queue types only; no queue selected = unassigned. Click selected queue again to deselect. */}
        {queueTypes
          .filter((queue) => {
            const queueName = typeof queue === "string" ? queue : queue.name;
            const isEnabled =
              typeof queue === "object" ? queue.isEnabled !== false : true;
            return isEnabled && queueName !== "Unassigned";
          })
          .map((queue) => {
            const queueName = typeof queue === "string" ? queue : queue.name;
            const colorToken =
              typeof queue === "object"
                ? (queue as { colorToken?: string | null }).colorToken
                : null;
            const isSelected = selectedQueue === queueName;
            const accent =
              colorToken != null ? getQueueAccentHex(colorToken) : undefined;
            return (
              <button
                key={queueName}
                type="button"
                onClick={() => {
                  onQueueChange(isSelected ? "unassigned" : queueName);
                }}
                disabled={disabled}
                className={`rounded-full px-4 py-2 text-sm transition-transform duration-150 active:scale-[0.98] ${getDynamicQueueStyle(colorToken ?? null, isSelected)} disabled:cursor-not-allowed disabled:opacity-50`}
                style={{
                  backgroundColor: accent,
                  borderColor: accent,
                  opacity: colorToken && !isSelected ? 0.85 : undefined,
                }}
                title={
                  isSelected
                    ? "Click again to leave post unassigned"
                    : undefined
                }
              >
                {queueName}
              </button>
            );
          })}
      </div>
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
