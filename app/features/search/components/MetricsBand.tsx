import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const cellClass =
  "bg-surface flex flex-col items-center justify-center gap-0.5 px-2 py-3 text-center";

export interface SearchStatsShape {
  likes: number;
  replies: number;
  mentions: number;
  reposts: number;
  zaps: number;
  satszapped: number;
}

export interface MetricsBandProps {
  stats: SearchStatsShape;
  statsUnavailable?: boolean;
  className?: string;
}

const CELLS: Array<{ key: keyof SearchStatsShape; label: string }> = [
  { key: "likes", label: "Likes" },
  { key: "replies", label: "Replies" },
  { key: "reposts", label: "Reposts" },
  { key: "zaps", label: "Zaps" },
  { key: "mentions", label: "Mentions" },
  { key: "satszapped", label: "Sats" },
];

export function MetricsBand({
  stats,
  statsUnavailable,
  className,
}: MetricsBandProps) {
  return (
    <div className={cn("space-y-0", className)}>
      <div className="border-border bg-border shadow-1 grid grid-cols-3 gap-px overflow-hidden rounded-xl border sm:grid-cols-6">
        {CELLS.map(({ key, label }) => (
          <div key={key} className={cellClass}>
            <span className="text-text-secondary text-[11px] font-medium tracking-wide uppercase">
              {label}
            </span>
            <span className="text-text text-base font-semibold tabular-nums">
              {stats[key]}
            </span>
          </div>
        ))}
      </div>
      {statsUnavailable ? (
        <div className="mt-2 flex justify-center">
          <Badge variant="outline" className="text-text-secondary font-normal">
            Stats unavailable (relay or index timeout)
          </Badge>
        </div>
      ) : null}
    </div>
  );
}
