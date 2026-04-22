import type { ReactNode } from "react";

/**
 * @deprecated Prefer `ActionRail` and related primitives from
 * `~/components/action-rail` for sticky summary rails (unified with Composer).
 */
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
    <aside className="border-border bg-surface-raised shadow-2 h-fit w-full min-w-0 space-y-4 self-start rounded-lg border p-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="text-text-secondary text-xs">{hint}</p>
      </div>
      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex justify-between gap-2">
            <dt className="text-text-secondary">{row.label}</dt>
            <dd className="text-right">{row.value}</dd>
          </div>
        ))}
      </dl>
      {warnings && warnings.length > 0 ? (
        <div className="border-warning/40 bg-warning/10 rounded-md border p-3">
          <p className="text-warning-text mb-1 text-xs font-medium">
            {warningsTitle ?? "Warnings"}
          </p>
          <ul className="text-text-secondary list-inside list-disc text-xs">
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
