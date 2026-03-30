import { cn } from "~/lib/utils";

import { SettingsSectionHeader } from "./SettingsSectionHeader";

export interface AccountSummarySectionProps {
  title: string;
  description?: string;
  /** Metrics / current state (plan, balances) — lead with this. */
  summary: React.ReactNode;
  /** Optional management actions below summary. */
  actions?: React.ReactNode;
  /** Supporting detail last. */
  detail?: React.ReactNode;
  className?: string;
}

/**
 * Pattern D — subscription, billing, referral earnings: state before controls.
 */
export function AccountSummarySection({
  title,
  description,
  summary,
  actions,
  detail,
  className,
}: AccountSummarySectionProps) {
  return (
    <section
      className={cn(
        "border-border/80 bg-card rounded-lg border px-4 py-4 shadow-sm sm:px-5 sm:py-5",
        className
      )}
    >
      <SettingsSectionHeader title={title} description={description} />
      <div className="mt-4 space-y-4">{summary}</div>
      {actions ? (
        <div className="border-border/60 mt-4 border-t pt-4">{actions}</div>
      ) : null}
      {detail ? (
        <div className="border-border/60 mt-4 border-t pt-4">{detail}</div>
      ) : null}
    </section>
  );
}
