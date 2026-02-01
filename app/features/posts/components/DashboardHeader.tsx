/**
 * Dashboard header component showing section title
 */

interface DashboardHeaderProps {
  currentTab: string;
  allContentCount: number;
  postsCount: number;
  longformCount: number;
  /** Last future item's scheduled time (unused; Runway KPI shows this) */
  flowRunsUntil?: Date | string | null;
  /** Optional class for layout (e.g. flex-shrink-0 when in a row with tabs) */
  className?: string;
}

export function DashboardHeader({
  currentTab,
  className,
}: DashboardHeaderProps) {
  const getTitle = () => {
    if (currentTab === "all") return "Your flow";
    if (currentTab === "posts") return "Scheduled Posts";
    return "Scheduled Longform";
  };

  return (
    <div
      className={`flex flex-shrink-0 flex-col gap-1 text-center sm:flex-row sm:items-center sm:text-left ${className ?? ""}`}
    >
      <div className="mb-2">
        <h3 className="mb-0.5 font-semibold">{getTitle()}</h3>
      </div>
    </div>
  );
}
