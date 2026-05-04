import type { BulkBatchMode } from "~/features/posts/bulk-composer/types";
import { RailSegmentedTabGroup } from "~/features/posts/components/publishing-rail/RailSegmentedTabGroup";

const BATCH_ITEMS: Array<{
  id: BulkBatchMode;
  label: string;
  ariaLabel: string;
}> = [
  {
    id: "schedule",
    label: "Schedule",
    ariaLabel: "Schedule posts for specific times",
  },
  {
    id: "queue",
    label: "Queue",
    ariaLabel: "Add posts to a queue",
  },
];

/** Schedule / Queue tabs  -  same primitive as publish rail `RailSegmentedTabs`. */
export function BulkBatchModeTabs({
  value,
  onValueChange,
  disabled = false,
}: {
  value: BulkBatchMode;
  onValueChange: (next: BulkBatchMode) => void;
  disabled?: boolean;
}) {
  return (
    <RailSegmentedTabGroup
      items={BATCH_ITEMS}
      value={value}
      onValueChange={(id) => onValueChange(id as BulkBatchMode)}
      columns={2}
      radiogroupAriaLabel="Batch mode"
      disabled={disabled}
    />
  );
}
