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
}

export function DashboardHeader({
  currentTab,
  flowRunsUntil,
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
    <div className="mt-4 mb-3 flex flex-col gap-1 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
      <div>
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
