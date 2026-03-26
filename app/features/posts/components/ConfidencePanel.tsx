import { useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import type { ComposerPublishMode } from "~/features/posts/composer/components/composer";

export interface PublishingSummarySection {
  title: string;
  lines?: string[];
  controls?: ReactNode;
}

export interface PublishingSummaryRailProps {
  publishMode: ComposerPublishMode;
  onPublishModeChange: (next: ComposerPublishMode) => void;
  readinessLabel: string;
  modeSpecificSection?: PublishingSummarySection;
  followUpSection?: PublishingSummarySection;
  threadSettingsSection?: PublishingSummarySection;
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

const SECTION_LINE_LIMIT = 4;
const ISSUE_LINE_LIMIT = 3;

function compactLines(lines: string[], limit: number): string[] {
  if (lines.length <= limit) return lines;
  const hiddenCount = lines.length - limit;
  return [...lines.slice(0, limit), `+${hiddenCount} more`];
}

function SectionBlock({
  title,
  lines = [],
  controls,
}: PublishingSummarySection) {
  if (lines.length === 0 && !controls) return null;
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
        {controls ? <div className="pt-1">{controls}</div> : null}
      </div>
    </div>
  );
}

function PublishingSummaryRailBody({
  publishMode,
  onPublishModeChange,
  readinessLabel,
  modeSpecificSection,
  followUpSection,
  threadSettingsSection,
  contentSection,
  publishPathSection,
  issues = [],
  warnings = [],
}: Omit<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "primaryActionDisabled"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
  | "saveStateLabel"
>) {
  const compactIssues = compactLines(issues, ISSUE_LINE_LIMIT);
  const compactWarnings = compactLines(warnings, ISSUE_LINE_LIMIT);
  const modeOptions: Array<{ value: ComposerPublishMode; label: string }> = [
    { value: "now", label: "Now" },
    { value: "schedule", label: "Schedule" },
    { value: "queue", label: "Queue" },
  ];

  return (
    <div className="space-y-2.5 text-xs">
      <div className="rounded-md border px-2 py-1.5 text-xs">
        <p className="font-semibold">Delivery mode</p>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {modeOptions.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant={publishMode === option.value ? "default" : "outline"}
              className="h-7 text-[11px]"
              onClick={() => onPublishModeChange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground mt-2">
          Readiness: {readinessLabel}
        </p>
      </div>
      {threadSettingsSection ? (
        <SectionBlock {...threadSettingsSection} />
      ) : null}
      {modeSpecificSection ? <SectionBlock {...modeSpecificSection} /> : null}
      {followUpSection ? <SectionBlock {...followUpSection} /> : null}
      <SectionBlock {...publishPathSection} />
      <SectionBlock {...contentSection} />
      {compactIssues.length > 0 || compactWarnings.length > 0 ? (
        <div className="rounded-md border px-2 py-1.5 text-xs">
          <p className="mb-1 font-semibold">Validation</p>
          {compactIssues.length > 0 ? (
            <div className="rounded-md border border-red-300 bg-red-500/10 px-2 py-1.5 text-xs text-red-700 dark:border-red-900 dark:text-red-300">
              {compactIssues.map((issue) => (
                <p key={issue}>{issue}</p>
              ))}
            </div>
          ) : null}
          {compactWarnings.length > 0 ? (
            <div className="mt-1 rounded-md border border-amber-200 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-500/10 dark:text-amber-400">
              {compactWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
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
  saveStateLabel,
}: Pick<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "primaryActionDisabled"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
  | "saveStateLabel"
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
      {saveStateLabel ? (
        <p className="text-muted-foreground text-center text-[11px]">
          {saveStateLabel}
        </p>
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
        aria-label="Publishing"
      >
        <h3 className="text-foreground mb-2 text-[11px] font-semibold tracking-wider uppercase">
          Publishing
        </h3>
        <div className="min-h-0 flex-1 space-y-0 pr-0">
          <PublishingSummaryRailBody
            publishMode={props.publishMode}
            onPublishModeChange={props.onPublishModeChange}
            readinessLabel={props.readinessLabel}
            modeSpecificSection={props.modeSpecificSection}
            followUpSection={props.followUpSection}
            threadSettingsSection={props.threadSettingsSection}
            contentSection={props.contentSection}
            publishPathSection={props.publishPathSection}
            issues={props.issues}
            warnings={props.warnings}
          />
        </div>
        <PublishingSummaryRailActions
          primaryActionLabel={props.primaryActionLabel}
          onPrimaryAction={props.onPrimaryAction}
          primaryActionDisabled={props.primaryActionDisabled}
          secondaryActionLabel={props.secondaryActionLabel}
          onSecondaryAction={props.onSecondaryAction}
          secondaryActionDisabled={props.secondaryActionDisabled}
          saveStateLabel={props.saveStateLabel}
        />
      </aside>

      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Publishing
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[80vh]">
            <SheetHeader>
              <SheetTitle>Publishing</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <PublishingSummaryRailBody
                publishMode={props.publishMode}
                onPublishModeChange={props.onPublishModeChange}
                readinessLabel={props.readinessLabel}
                modeSpecificSection={props.modeSpecificSection}
                followUpSection={props.followUpSection}
                threadSettingsSection={props.threadSettingsSection}
                contentSection={props.contentSection}
                publishPathSection={props.publishPathSection}
                issues={props.issues}
                warnings={props.warnings}
              />
              <PublishingSummaryRailActions
                primaryActionLabel={props.primaryActionLabel}
                onPrimaryAction={props.onPrimaryAction}
                primaryActionDisabled={props.primaryActionDisabled}
                secondaryActionLabel={props.secondaryActionLabel}
                onSecondaryAction={props.onSecondaryAction}
                secondaryActionDisabled={props.secondaryActionDisabled}
                saveStateLabel={props.saveStateLabel}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
