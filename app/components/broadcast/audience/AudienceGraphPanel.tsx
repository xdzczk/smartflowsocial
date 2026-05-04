import { useFetcher } from "@remix-run/react";
import { useEffect } from "react";

import { audienceRiskForSource } from "~/features/broadcast/audience/audience-risk";
import { cn } from "~/lib/utils";

export interface AudienceGraphPanelProps {
  /** Optional: share estimate with parent (e.g. summary card) without a second fetch. */
  onEstimateStats?: (s: { count: number | null; fetchFailed: boolean }) => void;
}

export function AudienceGraphPanel({
  onEstimateStats,
}: AudienceGraphPanelProps) {
  const fetcher = useFetcher<{ count: number | null; fetchFailed: boolean }>();
  const risk = audienceRiskForSource("MUTUALS");

  useEffect(() => {
    fetcher.load("/api/broadcast-audience-estimate?type=MUTUALS");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on mount
  }, []);

  const count = fetcher.data?.count;
  const failed = fetcher.data?.fetchFailed;

  useEffect(() => {
    if (!onEstimateStats || !fetcher.data) return;
    onEstimateStats({
      count: fetcher.data.count ?? null,
      fetchFailed: !!fetcher.data.fetchFailed,
    });
  }, [fetcher.data, onEstimateStats]);

  return (
    <div className="border-border space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium",
            risk.level === "low"
              ? "bg-success/15 text-success-text"
              : "bg-warning/15 text-warning-text"
          )}
        >
          {risk.label}
        </span>
      </div>
      <p className="text-text-secondary text-sm">
        Resolved at send time from mutual follow relationships. Best for direct
        updates to accounts with a two-way relationship.
      </p>
      <p className="text-sm">
        <span className="text-text-secondary">Estimated audience size: </span>
        <strong className="text-text">
          {fetcher.state === "loading"
            ? "…"
            : failed
              ? "Unavailable"
              : count != null
                ? String(count)
                : "—"}
        </strong>
        {failed ? (
          <span className="text-text-secondary text-xs">
            {" "}
            (graph cache could not be loaded - try again or use a custom list)
          </span>
        ) : null}
      </p>
    </div>
  );
}
