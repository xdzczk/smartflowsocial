/**
 * Section header for the Dashboard flow view ("Your flow").
 * Used only on the main Dashboard page.
 */

interface FlowSectionHeaderProps {
  /** Current content-type tab (all, posts, reposts, longform) */
  currentTab: string;
  /** Last future item's scheduled time (unused; Runway KPI shows this) */
  flowRunsUntil?: Date | string | null;
  /** Optional class for layout (e.g. flex-shrink-0 when in a row with tabs) */
  className?: string;
}

function getTitle(currentTab: string): string {
  if (currentTab === "all") return "Your flow";
  if (currentTab === "posts") return "Scheduled Posts";
  if (currentTab === "reposts") return "Scheduled Reposts";
  return "Scheduled Articles";
}

export function FlowSectionHeader({
  currentTab,
  className,
}: FlowSectionHeaderProps) {
  return (
    <div
      className={`flex flex-shrink-0 flex-row items-center text-left ${className ?? ""}`}
    >
      <h3 className="font-semibold">{getTitle(currentTab)}</h3>
    </div>
  );
}
