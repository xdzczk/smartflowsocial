import type { ReactNode } from "react";

import {
  ActionRail,
  ActionRailLabel,
  ActionRailNotice,
  type ActionRailNoticeVariant,
  ActionRailRow,
  type ActionRailRowEmphasis,
  type ActionRailRowTone,
  ActionRailSection,
  RAIL_MAJOR_DIVIDE,
  RAIL_STACK_ROWS,
  RAIL_SUMMARY_TO_FEEDBACK,
} from "~/components/action-rail";
import { cn } from "~/lib/utils";

import { CampaignOutcomeSentence } from "./CampaignOutcomeSentence";

export interface CampaignActionRailSnapshotRow {
  label: string;
  value: ReactNode;
  placeholder?: boolean;
  tone?: ActionRailRowTone;
  emphasis?: ActionRailRowEmphasis;
}

export interface CampaignActionRailFinancialRow {
  label: string;
  value: ReactNode;
  emphasis?: ActionRailRowEmphasis;
}

export function CampaignActionRail({
  ariaLabel,
  className,
  prependSections,
  snapshotLabel = "Campaign",
  snapshotRows,
  snapshotSecondaryRows,
  financialLabel = "Payout & fees",
  financialRows,
  blocker,
  serverError,
  outcomeHeadline,
  outcomeLine,
  outcomeHint,
  footer,
}: {
  ariaLabel: string;
  className?: string;
  /** Extra zones above snapshot (e.g. launch controls). */
  prependSections?: ReactNode;
  snapshotLabel?: string;
  snapshotRows: CampaignActionRailSnapshotRow[];
  snapshotSecondaryRows?: CampaignActionRailSnapshotRow[];
  financialLabel?: string;
  financialRows: CampaignActionRailFinancialRow[];
  blocker?: {
    variant: ActionRailNoticeVariant;
    title: string;
    lines: string[];
  } | null;
  /** Server or form error (destructive notice). */
  serverError?: string | null;
  outcomeHeadline?: ReactNode;
  outcomeLine?: string | null;
  outcomeHint?: string | null;
  footer: ReactNode;
}) {
  return (
    <ActionRail ariaLabel={ariaLabel} className={className} footer={footer}>
      <div className={cn("flex flex-col text-xs", RAIL_MAJOR_DIVIDE)}>
        {prependSections}
        <ActionRailSection>
          <ActionRailLabel>{snapshotLabel}</ActionRailLabel>
          <div className={RAIL_STACK_ROWS}>
            {snapshotRows.map((row) => (
              <ActionRailRow
                key={row.label}
                label={row.label}
                value={row.value}
                placeholder={row.placeholder}
                tone={row.tone}
                emphasis={row.emphasis ?? "default"}
              />
            ))}
          </div>
          {snapshotSecondaryRows != null && snapshotSecondaryRows.length > 0 ? (
            <div className="border-border/50 mt-2 border-t pt-2">
              <div className={cn(RAIL_STACK_ROWS, "opacity-95")}>
                {snapshotSecondaryRows.map((row) => (
                  <ActionRailRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    placeholder={row.placeholder}
                    tone={row.tone}
                    emphasis={row.emphasis ?? "muted"}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </ActionRailSection>

        <ActionRailSection>
          <ActionRailLabel>{financialLabel}</ActionRailLabel>
          <div className={RAIL_STACK_ROWS}>
            {financialRows.map((row) => (
              <ActionRailRow
                key={row.label}
                label={row.label}
                value={row.value}
                emphasis={row.emphasis ?? "default"}
              />
            ))}
          </div>
        </ActionRailSection>

        <ActionRailSection className="space-y-2">
          {serverError ? (
            <ActionRailNotice
              variant="error"
              title="Could not save"
              lines={[serverError]}
              className={RAIL_SUMMARY_TO_FEEDBACK}
            />
          ) : null}
          {blocker && blocker.lines.length > 0 ? (
            <ActionRailNotice
              variant={blocker.variant}
              title={blocker.title}
              lines={blocker.lines}
              className={RAIL_SUMMARY_TO_FEEDBACK}
            />
          ) : null}
          <CampaignOutcomeSentence
            className={RAIL_SUMMARY_TO_FEEDBACK}
            headline={outcomeHeadline}
            outcomeLine={outcomeLine ?? undefined}
            hint={outcomeHint ?? undefined}
          />
        </ActionRailSection>
      </div>
    </ActionRail>
  );
}
