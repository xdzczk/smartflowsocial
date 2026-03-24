import type { ReactNode } from "react";

export interface CampaignPayoutStat {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}

export function CampaignPayoutOverviewShell({
  title,
  stats,
  done,
  total,
  footer,
}: {
  title: string;
  stats: CampaignPayoutStat[];
  done: number;
  total: number;
  footer: ReactNode;
}) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="border-border bg-card space-y-3 rounded-lg border p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="text-muted-foreground">{stat.label}</dt>
            <dd className={stat.valueClassName ?? "font-semibold"}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      <div>
        <div className="text-muted-foreground mb-1 flex justify-between text-xs">
          <span>Progress</span>
          <span>
            {done}/{total} ({pct}%)
          </span>
        </div>
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div
            className="bg-primary h-full transition-[width]"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="text-muted-foreground text-xs">{footer}</p>
    </div>
  );
}
