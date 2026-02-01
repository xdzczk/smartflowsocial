import { useFormattedDate } from "~/lib/hooks/useFormattedDate";

/**
 * Dashboard header component showing title and one-line operational telemetry
 */

interface DashboardHeaderProps {
  currentTab: string;
  allContentCount: number;
  postsCount: number;
  longformCount: number;
  /** Last future item's scheduled time — used for "Flow runs until" telemetry */
  flowRunsUntil?: Date | string | null;
  /** Optional class for layout (e.g. flex-shrink-0 when in a row with tabs) */
  className?: string;
}

export function DashboardHeader({
  currentTab,
  flowRunsUntil,
  className,
}: DashboardHeaderProps) {
  const { formatDate, userTimezone } = useFormattedDate();

  const getTitle = () => {
    if (currentTab === "all") return "Your flow";
    if (currentTab === "posts") return "Scheduled Posts";
    return "Scheduled Longform";
  };

  const getTelemetry = (): string => {
    if (currentTab !== "all") return "";
    if (flowRunsUntil == null) return "Nothing scheduled.";
    const date =
      flowRunsUntil instanceof Date ? flowRunsUntil : new Date(flowRunsUntil);
    if (Number.isNaN(date.getTime())) return "Nothing scheduled.";
    const formatted = formatDate(date, { timezone: userTimezone });
    return `Flow runs until ${formatted}`;
  };

  const telemetry = getTelemetry();

  return (
    <div
      className={`flex flex-shrink-0 flex-col gap-1 text-center sm:flex-row sm:items-center sm:text-left ${className ?? ""}`}
    >
      <div className="mb-2">
        <h3 className="mb-0.5 font-semibold">{getTitle()}</h3>
        {telemetry ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {telemetry}
          </p>
        ) : null}
      </div>
    </div>
  );
}
