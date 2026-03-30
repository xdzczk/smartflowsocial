import { RailSegmentedTabGroup } from "~/features/posts/components/publishing-rail/RailSegmentedTabGroup";

export type BroadcastCommitMode = "now" | "schedule";

const BROADCAST_MODE_TABS = [
  { id: "now", label: "Now", ariaLabel: "Send after review" },
  { id: "schedule", label: "Schedule", ariaLabel: "Schedule for later" },
] as const;

export function BroadcastRailModeTabs({
  value,
  onValueChange,
}: {
  value: BroadcastCommitMode;
  onValueChange: (next: BroadcastCommitMode) => void;
}) {
  return (
    <RailSegmentedTabGroup
      items={[...BROADCAST_MODE_TABS]}
      value={value}
      onValueChange={(id) => {
        onValueChange(id as BroadcastCommitMode);
      }}
      columns={2}
      radiogroupAriaLabel="Broadcast send timing"
    />
  );
}
