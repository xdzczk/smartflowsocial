/**
 * Dashboard header component showing section title
 */

interface DashboardHeaderProps {
  currentTab: string;
  allContentCount: number;
  postsCount: number;
  repostsCount?: number;
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
    if (currentTab === "reposts") return "Scheduled Reposts";
    return "Scheduled Longform";
  };

  return (
    <div
      className={`flex flex-shrink-0 flex-row items-center text-left ${className ?? ""}`}
    >
      <h3 className="font-semibold">{getTitle()}</h3>
    </div>
  );
}
