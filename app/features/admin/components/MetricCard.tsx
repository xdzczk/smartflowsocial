import { Link } from "@remix-run/react";
import type { ReactNode } from "react";

import type { MetricConfidence } from "~/features/admin/metrics/metric-types";
import { cn } from "~/lib/utils";

import { AdminCard } from "./AdminCard";
import { AdminMetricTitleRow, AdminMetricValue } from "./AdminMetricValue";

export type MetricTone = "neutral" | "positive" | "warning" | "danger";

const confidenceBadgeClass: Record<MetricConfidence, string> = {
  confident: "bg-surface-hover text-text-secondary",
  directional: "bg-warning/15 text-warning-text",
  insufficient_sample: "bg-surface-hover text-text-secondary",
};

function ConfidenceBadge({
  confidence,
  note,
}: {
  confidence?: MetricConfidence;
  note?: string;
}) {
  if (!confidence || confidence === "confident") return null;
  const label = confidence === "directional" ? "Directional" : "Low sample";
  return (
    <span
      className={cn(
        "mt-1.5 inline-block rounded-xs px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase",
        confidenceBadgeClass[confidence]
      )}
      title={note}
    >
      {label}
    </span>
  );
}

const toneExtra: Record<MetricTone, string> = {
  neutral: "",
  positive: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  danger: "border-danger/30 bg-danger/5",
};

/** Matches AdminCard default variant shell for link-wrapped KPI drilldowns. */
const metricCardShell =
  "border-border bg-surface/60 border shadow-1 transition-shadow hover:shadow-2 rounded-xl p-4";

export function MetricCard({
  title,
  value,
  deltaPct,
  deltaLabel,
  interpretation,
  definition,
  footnote,
  tone = "neutral",
  href,
  confidence,
  confidenceNote,
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
  /** When set, the whole card links (e.g. drilldown to another admin tab). */
  href?: string;
  /** Low-sample / directional hint from shared metric layer. */
  confidence?: MetricConfidence;
  confidenceNote?: string;
}) {
  const inner: ReactNode = (
    <>
      <AdminMetricTitleRow title={title} definition={definition} />
      <AdminMetricValue
        className="mt-2"
        value={value}
        deltaPct={deltaPct}
        deltaLabel={deltaLabel}
      />
      <ConfidenceBadge confidence={confidence} note={confidenceNote} />
      {interpretation ? (
        <p className="text-text-secondary mt-2 text-xs leading-snug">
          {interpretation}
        </p>
      ) : null}
      {footnote ? (
        <details className="text-text-secondary mt-2 text-xs">
          <summary className="cursor-pointer text-[11px] font-medium tracking-wide uppercase">
            Details
          </summary>
          <p className="mt-1.5 leading-relaxed">{footnote}</p>
        </details>
      ) : null}
    </>
  );

  const cardClass = cn(
    "transition-transform hover:-translate-y-0.5",
    toneExtra[tone],
    href && "block cursor-pointer no-underline hover:no-underline"
  );

  if (href) {
    return (
      <Link
        to={href}
        className={cn(
          metricCardShell,
          "block cursor-pointer no-underline hover:no-underline",
          "hover:-translate-y-0.5",
          cardClass
        )}
      >
        {inner}
      </Link>
    );
  }

  return (
    <AdminCard variant="default" className={cardClass}>
      {inner}
    </AdminCard>
  );
}
