import type { ComposerPublishMode } from "~/features/posts/composer/components/composer";

import { RailSegmentedTabGroup } from "./RailSegmentedTabGroup";

const PUBLISH_ITEMS: Array<{
  id: ComposerPublishMode;
  label: string;
  ariaLabel: string;
}> = [
  { id: "now", label: "Now", ariaLabel: "Publish now, immediate" },
  {
    id: "schedule",
    label: "Schedule",
    ariaLabel: "Schedule for a specific time",
  },
  { id: "queue", label: "Queue", ariaLabel: "Add to queue" },
];

export function RailSegmentedTabs({
  value,
  onValueChange,
}: {
  value: ComposerPublishMode;
  onValueChange: (next: ComposerPublishMode) => void;
}) {
  return (
    <RailSegmentedTabGroup
      items={PUBLISH_ITEMS}
      value={value}
      onValueChange={(id) => onValueChange(id as ComposerPublishMode)}
      columns={3}
      radiogroupAriaLabel="Publishing mode"
    />
  );
}
