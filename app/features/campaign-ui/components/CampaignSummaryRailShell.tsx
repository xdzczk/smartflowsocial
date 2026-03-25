import type { ReactNode } from "react";

export interface CampaignSummaryRow {
  label: string;
  value: ReactNode;
}

export function CampaignSummaryRailShell({
  title,
  hint,
  rows,
  warningsTitle,
  warnings,
  footer,
}: {
  title: string;
  hint: string;
  rows: CampaignSummaryRow[];
  warningsTitle?: string;
  warnings?: string[];
  footer?: ReactNode;
}) {
  return (
    <aside className="border-border bg-card sticky top-20 h-fit w-full min-w-0 space-y-4 self-start rounded-lg border p-4">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-muted-foreground text-xs">{hint}</p>
      </div>
      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
      {warnings && warnings.length > 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="mb-1 text-xs font-medium text-amber-900 dark:text-amber-100">
            {warningsTitle ?? "Warnings"}
          </p>
          <ul className="text-muted-foreground list-inside list-disc text-xs">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {footer ? (
        <div className="border-border space-y-3 border-t pt-3">{footer}</div>
      ) : null}
    </aside>
  );
}
