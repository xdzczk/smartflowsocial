import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import type { ComposerPublishMode } from "~/features/posts/composer/components/composer";
import type {
  PublishPathSummary,
  ReadinessPresentation,
} from "~/features/posts/composer/components/composer/publishing-summary";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

export interface PublishingSummarySection {
  title: string;
  lines?: string[];
  controls?: ReactNode;
}

export interface PublishingSessionStripProps {
  composerStatus: ComposerStatus;
  relayCount: number;
  onRelayClick?: () => void;
  signerLabel: string | null;
  saveStateLabel: string | null;
}

export interface PublishingSummaryRailProps {
  publishMode: ComposerPublishMode;
  onPublishModeChange: (next: ComposerPublishMode) => void;
  /** Plain-language line directly under the mode selector. */
  outcomeSentence: string;
  readiness: ReadinessPresentation;
  /** Merged into Post status (not a separate Session card). */
  sessionStrip?: PublishingSessionStripProps;
  modeSpecificSection?: PublishingSummarySection;
  /** Collapsible follow-up row with summary (e.g. None / Repost · Quote). */
  followUp?: {
    summaryLine: string;
    children: ReactNode;
  };
  /** @deprecated Prefer `followUp` with collapsible summary. */
  followUpSection?: PublishingSummarySection;
  threadSettingsSection?: PublishingSummarySection;
  /** Single-line summary for Post status; preferred over contentSummaryLines. */
  postStatusSummaryInline?: string;
  /** Extra bullets under the inline summary (e.g. thread cadence). */
  contentSummaryLines?: string[];
  publishPath: PublishPathSummary;
  issues?: string[];
  warnings?: string[];
  /** When `sessionStrip` is omitted, passive save text under Save draft. */
  saveStateLabel?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  primaryActionDisabled?: boolean;
  /** When true, shows `primaryActionLoadingLabel` on the primary button. */
  primaryActionLoading?: boolean;
  primaryActionLoadingLabel?: string;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  secondaryActionDisabled?: boolean;
}

const SECTION_LINE_LIMIT = 4;
const ISSUE_LINE_LIMIT = 5;

function compactLines(lines: string[], limit: number): string[] {
  if (lines.length <= limit) return lines;
  const hiddenCount = lines.length - limit;
  return [...lines.slice(0, limit), `+${hiddenCount} more`];
}

function PublishingModeFusedHeader({
  publishMode,
  onPublishModeChange,
}: {
  publishMode: ComposerPublishMode;
  onPublishModeChange: (next: ComposerPublishMode) => void;
}) {
  const modes: ComposerPublishMode[] = ["now", "schedule", "queue"];
  const labels: Record<ComposerPublishMode, string> = {
    now: "Now",
    schedule: "Schedule",
    queue: "Queue",
  };
  const ariaLabels: Record<ComposerPublishMode, string> = {
    now: "Publish now, immediate",
    schedule: "Schedule for a specific time",
    queue: "Add to queue",
  };

  return (
    <div
      role="tablist"
      aria-label="Publishing mode"
      className="border-border bg-muted/40 grid grid-cols-3 overflow-hidden rounded-t-lg border border-b-0"
    >
      {modes.map((m) => {
        const active = publishMode === m;
        return (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={ariaLabels[m]}
            className={cn(
              "border-border min-h-[44px] border-r px-1 py-2.5 text-center text-xs transition-colors last:border-r-0",
              active
                ? "bg-card text-foreground z-[1] font-semibold"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
            onClick={() => onPublishModeChange(m)}
          >
            {labels[m]}
          </button>
        );
      })}
    </div>
  );
}

function DestinationChips({
  path,
  onRelayClick,
}: {
  path: PublishPathSummary;
  onRelayClick?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {onRelayClick ? (
        <button
          type="button"
          onClick={onRelayClick}
          className="border-border bg-background hover:bg-muted/80 inline-flex h-6 max-w-full items-center truncate rounded-md border px-2 text-[11px] font-medium"
        >
          {path.relayCount} relay{path.relayCount !== 1 ? "s" : ""}
        </button>
      ) : (
        <Badge variant="secondary" className="font-normal">
          {path.relayCount} relay{path.relayCount !== 1 ? "s" : ""}
        </Badge>
      )}
      <Badge variant="secondary" className="max-w-full truncate font-normal">
        {path.signerLabel?.trim() ? path.signerLabel : "Signer —"}
      </Badge>
      {path.queueLabel ? (
        <Badge variant="secondary" className="max-w-full truncate font-normal">
          {path.queueLabel}
        </Badge>
      ) : null}
    </div>
  );
}

function FollowUpRailCollapsible({
  summaryLine,
  children,
}: {
  summaryLine: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-border rounded-md border">
      <button
        type="button"
        className="text-muted-foreground hover:bg-muted/40 flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span>
          <span className="text-foreground font-semibold tracking-wide uppercase">
            Follow-up actions
          </span>
          <span className="text-muted-foreground ml-1.5 font-normal">
            {summaryLine}
          </span>
        </span>
        {open ? (
          <ChevronUp
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        ) : (
          <ChevronDown
            className={INLINE_ICON_SIZE_CLASS}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        )}
      </button>
      {open ? (
        <div className="border-border border-t px-2 py-2">{children}</div>
      ) : null}
    </div>
  );
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
      {title ? (
        <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
          {title}
        </span>
      ) : null}
      <div className={title ? "mt-0.5 space-y-0.5" : "space-y-0.5"}>
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

function PostStatusBlock({
  postStatusSummaryInline,
  contentSummaryLines = [],
  sessionStrip,
  publishPath,
  readiness,
  issues,
  warnings,
}: {
  postStatusSummaryInline?: string;
  contentSummaryLines?: string[];
  sessionStrip?: PublishingSessionStripProps;
  publishPath: PublishPathSummary;
  readiness: ReadinessPresentation;
  issues: string[];
  warnings: string[];
}) {
  const compactIssues = compactLines(issues, ISSUE_LINE_LIMIT);
  const compactWarnings = compactLines(warnings, ISSUE_LINE_LIMIT);
  const fallbackInline =
    contentSummaryLines.length > 0
      ? contentSummaryLines.slice(0, 3).join(" · ")
      : null;
  const summaryLine = postStatusSummaryInline ?? fallbackInline;

  return (
    <div className="border-border bg-muted/10 rounded-md border px-2 py-2">
      <p className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide uppercase">
        Post status
      </p>
      {summaryLine ? (
        <p className="text-foreground mb-2 text-xs leading-snug">
          {summaryLine}
        </p>
      ) : null}
      {contentSummaryLines.length > 3 ? (
        <ul className="text-muted-foreground mb-2 space-y-0.5 text-[11px] leading-snug">
          {contentSummaryLines.slice(3).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {sessionStrip ? (
          <Badge variant="outline" className="font-normal">
            {sessionStrip.composerStatus}
          </Badge>
        ) : null}
        <DestinationChips
          path={publishPath}
          onRelayClick={sessionStrip?.onRelayClick}
        />
      </div>
      {compactIssues.length === 0 && compactWarnings.length === 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="font-normal">
            {readiness.tone === "ok" ? "Ready" : readiness.headline}
          </Badge>
          {readiness.tone === "ok" ? (
            <span className="text-muted-foreground text-[11px]">
              No blocking issues
            </span>
          ) : null}
        </div>
      ) : null}
      {compactIssues.length > 0 ? (
        <div className="mt-2 space-y-1.5 rounded-md border border-red-300 bg-red-500/10 px-2 py-2 text-xs text-red-800 dark:border-red-900 dark:text-red-200">
          <p className="font-medium">{readiness.headline}</p>
          {compactIssues.map((issue) => (
            <p key={issue} className="text-[11px] leading-snug">
              {issue}
            </p>
          ))}
        </div>
      ) : null}
      {compactWarnings.length > 0 ? (
        <div className="mt-2 space-y-1 rounded-md border border-amber-200 bg-amber-500/10 px-2 py-2 text-xs text-amber-900 dark:border-amber-800 dark:text-amber-200">
          {compactWarnings.map((warning) => (
            <p key={warning} className="text-[11px] leading-snug">
              {warning}
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PublishingSummaryRailBody({
  publishMode,
  onPublishModeChange,
  outcomeSentence,
  readiness,
  sessionStrip,
  modeSpecificSection,
  followUp,
  followUpSection,
  threadSettingsSection,
  postStatusSummaryInline,
  contentSummaryLines = [],
  publishPath,
  issues = [],
  warnings = [],
}: Omit<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "primaryActionDisabled"
  | "primaryActionLoading"
  | "primaryActionLoadingLabel"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
  | "saveStateLabel"
>) {
  return (
    <div className="flex flex-col gap-2.5 text-xs">
      <div className="border-border bg-card overflow-hidden rounded-lg border shadow-sm">
        <PublishingModeFusedHeader
          publishMode={publishMode}
          onPublishModeChange={onPublishModeChange}
        />
        <div className="border-border bg-card border-t px-2.5 py-2">
          <p className="text-foreground text-sm leading-snug font-medium">
            {outcomeSentence}
          </p>
        </div>
      </div>

      {threadSettingsSection ? (
        <SectionBlock {...threadSettingsSection} />
      ) : null}
      {modeSpecificSection ? <SectionBlock {...modeSpecificSection} /> : null}
      {followUp ? (
        <FollowUpRailCollapsible summaryLine={followUp.summaryLine}>
          {followUp.children}
        </FollowUpRailCollapsible>
      ) : followUpSection ? (
        <SectionBlock {...followUpSection} />
      ) : null}

      <PostStatusBlock
        postStatusSummaryInline={postStatusSummaryInline}
        contentSummaryLines={contentSummaryLines}
        sessionStrip={sessionStrip}
        publishPath={publishPath}
        readiness={readiness}
        issues={issues}
        warnings={warnings}
      />
    </div>
  );
}

function PublishingSummaryRailActions({
  primaryActionLabel,
  onPrimaryAction,
  primaryActionDisabled,
  primaryActionLoading,
  primaryActionLoadingLabel,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
  footerSaveHelper,
}: Pick<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "primaryActionDisabled"
  | "primaryActionLoading"
  | "primaryActionLoadingLabel"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
> & {
  footerSaveHelper?: string | null;
}) {
  const showLoading = Boolean(
    primaryActionLoading && primaryActionLoadingLabel
  );
  const label = showLoading ? primaryActionLoadingLabel! : primaryActionLabel;

  return (
    <div className="border-border bg-card mt-2 shrink-0 space-y-2 rounded-lg border p-2 shadow-sm">
      {secondaryActionLabel && onSecondaryAction ? (
        <div className="space-y-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-full text-xs"
            onClick={onSecondaryAction}
            disabled={secondaryActionDisabled}
          >
            {secondaryActionLabel}
          </Button>
          {footerSaveHelper ? (
            <p className="text-muted-foreground px-0.5 text-center text-[11px] leading-snug">
              {footerSaveHelper}
            </p>
          ) : null}
        </div>
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="default"
        className="h-10 w-full text-xs font-semibold"
        onClick={onPrimaryAction}
        disabled={Boolean(primaryActionDisabled) || showLoading}
      >
        {label}
      </Button>
    </div>
  );
}

export function PublishingSummaryRail(props: PublishingSummaryRailProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const footerSaveHelper =
    props.sessionStrip?.saveStateLabel ?? props.saveStateLabel ?? null;

  const bodyProps = {
    publishMode: props.publishMode,
    onPublishModeChange: props.onPublishModeChange,
    outcomeSentence: props.outcomeSentence,
    readiness: props.readiness,
    sessionStrip: props.sessionStrip,
    modeSpecificSection: props.modeSpecificSection,
    followUp: props.followUp,
    followUpSection: props.followUpSection,
    threadSettingsSection: props.threadSettingsSection,
    postStatusSummaryInline: props.postStatusSummaryInline,
    contentSummaryLines: props.contentSummaryLines,
    publishPath: props.publishPath,
    issues: props.issues,
    warnings: props.warnings,
  };

  return (
    <>
      <aside
        className="border-border bg-card hidden w-72 shrink-0 self-start rounded-lg border p-2 shadow-md lg:sticky lg:top-16 lg:flex lg:max-h-[calc(100vh-5rem)] lg:flex-col xl:w-80"
        aria-label="Publish"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          <PublishingSummaryRailBody {...bodyProps} />
        </div>
        <PublishingSummaryRailActions
          primaryActionLabel={props.primaryActionLabel}
          onPrimaryAction={props.onPrimaryAction}
          primaryActionDisabled={props.primaryActionDisabled}
          primaryActionLoading={props.primaryActionLoading}
          primaryActionLoadingLabel={props.primaryActionLoadingLabel}
          secondaryActionLabel={props.secondaryActionLabel}
          onSecondaryAction={props.onSecondaryAction}
          secondaryActionDisabled={props.secondaryActionDisabled}
          footerSaveHelper={
            props.secondaryActionLabel && props.onSecondaryAction
              ? footerSaveHelper
              : undefined
          }
        />
      </aside>

      <div className="lg:hidden">
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Publish
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="flex max-h-[85vh] flex-col">
            <SheetHeader className="shrink-0">
              <SheetTitle>Publish</SheetTitle>
            </SheetHeader>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
              <PublishingSummaryRailBody {...bodyProps} />
            </div>
            <div className="shrink-0 pt-2">
              <PublishingSummaryRailActions
                primaryActionLabel={props.primaryActionLabel}
                onPrimaryAction={() => {
                  props.onPrimaryAction();
                  setSheetOpen(false);
                }}
                primaryActionDisabled={props.primaryActionDisabled}
                primaryActionLoading={props.primaryActionLoading}
                primaryActionLoadingLabel={props.primaryActionLoadingLabel}
                secondaryActionLabel={props.secondaryActionLabel}
                onSecondaryAction={props.onSecondaryAction}
                secondaryActionDisabled={props.secondaryActionDisabled}
                footerSaveHelper={
                  props.secondaryActionLabel && props.onSecondaryAction
                    ? footerSaveHelper
                    : undefined
                }
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
