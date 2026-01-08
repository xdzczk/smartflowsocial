import { getDynamicQueueStyle } from "../queueColors";
import type { QueueType } from "../types";
interface QueueSelectorProps {
  queueTypes: Array<string | QueueType>;
  selectedQueue: string;
  onQueueChange: (queue: string) => void;
  disabled?: boolean;
  className?: string;
}

export function QueueSelector({
  queueTypes,
  selectedQueue,
  onQueueChange,
  disabled = false,
  className = "",
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
      <label
        id="queue-type-label"
        htmlFor="queue-type-selector"
        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Queue Type
      </label>
      <div
        id="queue-type-selector"
        className="flex flex-wrap gap-2"
        role="group"
        aria-labelledby="queue-type-label"
      >
        {/* Unassigned option */}
        <button
          type="button"
          onClick={() => onQueueChange("unassigned")}
          disabled={disabled}
          className={`rounded-full px-4 py-2 text-sm ${getDynamicQueueStyle(null, selectedQueue === "unassigned")} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Unassigned
        </button>

        {/* Queue types */}
        {queueTypes
          .filter((queue) => {
            const queueName = typeof queue === "string" ? queue : queue.name;
            const isEnabled =
              typeof queue === "object" ? queue.isEnabled !== false : true;
            // Exclude "Unassigned" queue type since we have a hard-coded unassigned option
            return isEnabled && queueName !== "Unassigned";
          })
          .map((queue) => {
            const queueName = typeof queue === "string" ? queue : queue.name;
            const queueColor = typeof queue === "object" ? queue.color : null;
            return (
              <button
                key={queueName}
                type="button"
                onClick={() => onQueueChange(queueName)}
                disabled={disabled}
                className={`rounded-full px-4 py-2 text-sm ${getDynamicQueueStyle(queueColor ?? null, selectedQueue === queueName)} disabled:cursor-not-allowed disabled:opacity-50`}
                style={{
                  backgroundColor: queueColor ?? undefined,
                  borderColor: queueColor ?? undefined,
                }}
              >
                {queueName}
              </button>
            );
          })}
      </div>
      <input type="hidden" name="queueType" value={selectedQueue} />
      <input
        type="hidden"
        name="queueTypeId"
        value={getQueueTypeId(selectedQueue)}
      />
    </div>
  );
}
