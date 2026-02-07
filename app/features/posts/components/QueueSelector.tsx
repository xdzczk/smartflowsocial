import { getDynamicQueueStyle } from "../queue-colors";
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
            const queueColor = typeof queue === "object" ? queue.color : null;
            const isSelected = selectedQueue === queueName;
            return (
              <button
                key={queueName}
                type="button"
                onClick={() => {
                  onQueueChange(isSelected ? "unassigned" : queueName);
                }}
                disabled={disabled}
                className={`rounded-full px-4 py-2 text-sm transition-transform duration-150 active:scale-[0.98] ${getDynamicQueueStyle(queueColor ?? null, isSelected)} disabled:cursor-not-allowed disabled:opacity-50`}
                style={{
                  backgroundColor: queueColor ?? undefined,
                  borderColor: queueColor ?? undefined,
                  opacity: queueColor && !isSelected ? 0.85 : undefined,
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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="text-muted-foreground h-3.5 w-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
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
