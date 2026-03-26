import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

export interface PublishingSummarySection {
  title: string;
  lines: string[];
}

export interface PublishingSummaryRailProps {
  readinessLabel: string;
  deliverySection: PublishingSummarySection;
  contentSection: PublishingSummarySection;
  publishPathSection: PublishingSummarySection;
  issues?: string[];
  warnings?: string[];
  saveStateLabel?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionDisabled?: boolean;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionDisabled?: boolean;
}

const SECTION_LINE_LIMIT = 3;
const ISSUE_LINE_LIMIT = 2;

function compactLines(lines: string[], limit: number): string[] {
  if (lines.length <= limit) return lines;
  const hiddenCount = lines.length - limit;
  return [...lines.slice(0, limit), `+${hiddenCount} more`];
}

function SectionBlock({ title, lines }: PublishingSummarySection) {
  if (lines.length === 0) return null;
  const compacted = compactLines(lines, SECTION_LINE_LIMIT);
  return (
    <div className="bg-muted/10 rounded-md px-2 py-1.5">
      <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
        {title}
      </span>
      <div className="mt-0.5 space-y-0.5">
        {compacted.map((line) => (
          <p key={line} className="text-xs leading-snug">
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}

function PublishingSummaryRailBody({
  readinessLabel,
  deliverySection,
  contentSection,
  publishPathSection,
  issues = [],
  warnings = [],
  saveStateLabel,
}: Omit<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "primaryActionDisabled"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
>) {
  const compactIssues = compactLines(issues, ISSUE_LINE_LIMIT);
  const compactWarnings = compactLines(warnings, ISSUE_LINE_LIMIT);
  return (
    <div className="space-y-2.5 text-xs">
      <div className="rounded-md border px-2 py-1.5 text-xs">
        <p className="font-semibold">Readiness</p>
        <p>{readinessLabel}</p>
      </div>
      {compactIssues.length > 0 ? (
        <div className="rounded-md border border-red-300 bg-red-500/10 px-2 py-1.5 text-xs text-red-700 dark:border-red-900 dark:text-red-300">
          {compactIssues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      ) : null}
      {compactWarnings.length > 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
          {compactWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      <SectionBlock
        title={deliverySection.title}
        lines={deliverySection.lines}
      />
      <SectionBlock title={contentSection.title} lines={contentSection.lines} />
      <SectionBlock
        title={publishPathSection.title}
        lines={
          saveStateLabel
            ? [...publishPathSection.lines, `Save state: ${saveStateLabel}`]
            : publishPathSection.lines
        }
      />
    </div>
  );
}

function PublishingSummaryRailActions({
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
}: Pick<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "primaryActionDisabled"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
>) {
  return (
    <div className="border-border bg-background/95 space-y-1.5 border-t pt-2 backdrop-blur">
      <Button
        type="button"
        size="sm"
        className="bg-success hover:bg-success/90 h-8 w-full text-xs text-white"
        onClick={onPrimaryAction}
        disabled={primaryActionDisabled}
      >
        {primaryActionLabel}
      </Button>
      {secondaryActionLabel && onSecondaryAction ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={onSecondaryAction}
          disabled={secondaryActionDisabled}
        >
          {secondaryActionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export function PublishingSummaryRail(props: PublishingSummaryRailProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  return (
    <>
      <aside
        className="border-border bg-card hidden w-64 shrink-0 self-start rounded-lg border p-3 shadow-md lg:sticky lg:top-16 lg:flex lg:max-h-[calc(100vh-5rem)] lg:flex-col"
        aria-label="Publishing summary"
      >
        <h3 className="text-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
          Publishing Summary
        </h3>
        <div className="min-h-0 flex-1 space-y-0 pr-0">
          <PublishingSummaryRailBody
            readinessLabel={props.readinessLabel}
            deliverySection={props.deliverySection}
            contentSection={props.contentSection}
            publishPathSection={props.publishPathSection}
            issues={props.issues}
            warnings={props.warnings}
            saveStateLabel={props.saveStateLabel}
          />
        </div>
        <PublishingSummaryRailActions
          primaryActionLabel={props.primaryActionLabel}
          onPrimaryAction={props.onPrimaryAction}
          primaryActionDisabled={props.primaryActionDisabled}
          secondaryActionLabel={props.secondaryActionLabel}
          onSecondaryAction={props.onSecondaryAction}
          secondaryActionDisabled={props.secondaryActionDisabled}
        />
      </aside>

      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Publishing Summary
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Publishing Summary</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <PublishingSummaryRailBody
                readinessLabel={props.readinessLabel}
                deliverySection={props.deliverySection}
                contentSection={props.contentSection}
                publishPathSection={props.publishPathSection}
                issues={props.issues}
                warnings={props.warnings}
                saveStateLabel={props.saveStateLabel}
              />
              <PublishingSummaryRailActions
                primaryActionLabel={props.primaryActionLabel}
                onPrimaryAction={props.onPrimaryAction}
                primaryActionDisabled={props.primaryActionDisabled}
                secondaryActionLabel={props.secondaryActionLabel}
                onSecondaryAction={props.onSecondaryAction}
                secondaryActionDisabled={props.secondaryActionDisabled}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
