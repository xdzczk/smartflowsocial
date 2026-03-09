/**
 * Presentational queue selection field. Wraps QueueSelector.
 */

import { QueueSelector } from "~/features/posts/components/QueueSelector";
import type { QueueType } from "~/features/posts/types";

export interface ComposerQueueFieldProps {
  queueTypes: Array<string | QueueType>;
  value: string;
  onChange: (queue: string) => void;
  disabled?: boolean;
  /** When slot-based queue is selected, show e.g. "Next: Sat 18:00" */
  nextSlot?: string;
  className?: string;
}

export function ComposerQueueField({
  queueTypes,
  value,
  onChange,
  disabled = false,
  nextSlot,
  className = "",
}: ComposerQueueFieldProps) {
  return (
    <QueueSelector
      queueTypes={queueTypes}
      selectedQueue={value}
      onQueueChange={onChange}
      disabled={disabled}
      className={className}
      nextSlot={nextSlot}
    />
  );
}
