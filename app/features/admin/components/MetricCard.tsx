import { cn } from "~/lib/utils";

export type MetricTone = "neutral" | "positive" | "warning" | "danger";

const toneClass: Record<MetricTone, string> = {
  neutral: "border-border",
  positive: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  danger: "border-red-500/30 bg-red-500/5",
};

export function MetricCard({
  title,
  value,
  deltaPct,
  interpretation,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  deltaPct?: number | null;
  interpretation?: string;
  tone?: MetricTone;
}) {
  const deltaStr =
    deltaPct === null || deltaPct === undefined
      ? null
      : `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}% vs prior period`;

  return (
    <div className={cn("rounded-lg border p-4 shadow-sm", toneClass[tone])}>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {deltaStr ? (
        <p className="text-muted-foreground mt-1 text-xs">{deltaStr}</p>
      ) : null}
      {interpretation ? (
        <p className="text-muted-foreground mt-2 text-xs leading-snug">
          {interpretation}
        </p>
      ) : null}
    </div>
  );
}
