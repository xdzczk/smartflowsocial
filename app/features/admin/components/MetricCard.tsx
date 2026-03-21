import { cn } from "~/lib/utils";

import { AdminCard } from "./AdminCard";
import { AdminMetricTitleRow, AdminMetricValue } from "./AdminMetricValue";

export type MetricTone = "neutral" | "positive" | "warning" | "danger";

const toneExtra: Record<MetricTone, string> = {
  neutral: "",
  positive: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  danger: "border-red-500/30 bg-red-500/5",
};

export function MetricCard({
  title,
  value,
  deltaPct,
  deltaLabel,
  interpretation,
  definition,
  footnote,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  deltaPct?: number | null;
  /** Overrides default delta string when set (including empty string to hide). */
  deltaLabel?: string | null;
  /** Short one-line context shown under the value. */
  interpretation?: string;
  /** Shown in an info tooltip next to the title. */
  definition?: string;
  /** Longer text in a collapsible block. */
  footnote?: string;
  tone?: MetricTone;
}) {
  return (
    <AdminCard
      variant="default"
      className={cn(
        "transition-transform hover:-translate-y-0.5",
        toneExtra[tone]
      )}
    >
      <AdminMetricTitleRow title={title} definition={definition} />
      <AdminMetricValue
        className="mt-2"
        value={value}
        deltaPct={deltaPct}
        deltaLabel={deltaLabel}
      />
      {interpretation ? (
        <p className="text-muted-foreground mt-2 text-xs leading-snug">
          {interpretation}
        </p>
      ) : null}
      {footnote ? (
        <details className="text-muted-foreground mt-2 text-xs">
          <summary className="cursor-pointer text-[11px] font-medium tracking-wide uppercase">
            Details
          </summary>
          <p className="mt-1.5 leading-relaxed">{footnote}</p>
        </details>
      ) : null}
    </AdminCard>
  );
}
