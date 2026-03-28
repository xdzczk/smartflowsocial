/**
 * Composer publish rail: delivery, validation, and primary publish actions.
 * Publishing Rail V3: single surface, divider-based zones, no nested section cards.
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
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
  title?: string;
  lines?: string[];
  controls?: ReactNode;
}

export interface PublishingSessionStripProps {
  composerStatus: ComposerStatus;
  relayCount: number;
  onRelayClick?: () => void;
  signerLabel: string | null;
}

/** Recyclable / distribution toggle — lives in the rail only. */
export interface PublishingRecyclableControlProps {
  switchId: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

export interface PublishingSummaryRailProps {
  publishMode: ComposerPublishMode;
  onPublishModeChange: (next: ComposerPublishMode) => void;
  /** Plain-language outcome; folded into publish summary (valid path). */
  outcomeSentence: string;
  readiness: ReadinessPresentation;
  sessionStrip?: PublishingSessionStripProps;
  modeSpecificSection?: PublishingSummarySection;
  followUp?: {
    summaryLine: string;
    children: ReactNode;
  };
  /** @deprecated Prefer `followUp` with collapsible summary. */
  followUpSection?: PublishingSummarySection;
  threadSettingsSection?: PublishingSummarySection;
  recyclableControl?: PublishingRecyclableControlProps;
  postStatusSummaryInline?: string;
  publishSummaryOptionsLine?: string;
  contentSummaryLines?: string[];
  /** When "stacked", render content summary as a vertical list (e.g. article checklist). */
  contentSummaryDisplay?: "inline" | "stacked";
  publishPath: PublishPathSummary;
  issues?: string[];
  warnings?: string[];
  pristineHint?: string;
  idleStatusLabel?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  onPrimaryActionBlocked?: () => void;
  primaryActionDisabled?: boolean;
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

/** Single line for publish summary (valid state), trimmed. */
function deriveSummaryOutcomeLine(
  publishMode: ComposerPublishMode,
  outcomeSentence: string
): string {
  const s = outcomeSentence.trim();
  if (!s) {
    return publishMode === "schedule"
      ? "Set a publish time to continue"
      : publishMode === "queue"
        ? "Choose a queue to continue"
        : "Add content and relays to publish";
  }
  return s.replace(/\.\s*$/, "");
}

function RailSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground mb-2 text-[10px] font-medium tracking-wide uppercase">
      {children}
    </p>
  );
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
      role="radiogroup"
      aria-label="Publishing mode"
      className="border-border/60 relative grid grid-cols-3 border-b"
    >
      {modes.map((m) => {
        const active = publishMode === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={ariaLabels[m]}
            className={cn(
              "border-border/60 min-h-[44px] border-e px-1 py-2.5 text-center text-xs transition-colors last:border-e-0",
              active
                ? "text-foreground bg-card border-b-card relative z-[1] -mb-px border-b font-semibold"
                : "text-muted-foreground hover:text-foreground font-medium"
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
    <div className="w-full">
      <button
        type="button"
        className="hover:bg-muted/40 flex w-full items-center gap-2 rounded-sm py-2 text-left text-xs"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-foreground w-24 shrink-0 font-medium">
          Follow-up
        </span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-right">
          {summaryLine}
        </span>
        {open ? (
          <ChevronUp
            className={cn(
              INLINE_ICON_SIZE_CLASS,
              "text-muted-foreground shrink-0"
            )}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        ) : (
          <ChevronDown
            className={cn(
              INLINE_ICON_SIZE_CLASS,
              "text-muted-foreground shrink-0"
            )}
            strokeWidth={INLINE_ICON_STROKE}
            aria-hidden
          />
        )}
      </button>
      {open ? (
        <div className="border-border/50 mt-1 border-t border-dashed pt-2 pl-0">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function RecyclableRailRow(props: PublishingRecyclableControlProps) {
  const {
    switchId,
    checked,
    onCheckedChange,
    disabled,
    label = "Recyclable",
    helperText,
  } = props;
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <div className="flex w-full items-center justify-between gap-2">
        <Label
          htmlFor={switchId}
          className="text-foreground text-xs font-medium"
        >
          {label}
        </Label>
        <Switch
          id={switchId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </div>
      {helperText ? (
        <p className="text-muted-foreground text-[10px] leading-snug">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

/** SectionBlock — only for deprecated followUpSection fallback (plain lines + controls). */
function SectionBlockFallback({
  title,
  lines = [],
  controls,
}: PublishingSummarySection) {
  if (lines.length === 0 && !controls) return null;
  const compacted = compactLines(lines, SECTION_LINE_LIMIT);
  return (
    <div className="space-y-1">
      {title ? (
        <span className="text-muted-foreground text-xs font-medium">
          {title}
        </span>
      ) : null}
      {compacted.map((line) => (
        <p key={line} className="text-[11px] leading-snug">
          {line}
        </p>
      ))}
      {controls ? <div className="pt-1">{controls}</div> : null}
    </div>
  );
}

function SummaryMetadataRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="text-[11px] leading-snug">
      <span className="text-muted-foreground font-medium">{label}</span>{" "}
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function PublishSummarySection({
  publishMode,
  outcomeSentence,
  postStatusSummaryInline,
  publishSummaryOptionsLine,
  contentSummaryLines = [],
  contentSummaryDisplay = "inline",
  sessionStrip,
  publishPath,
  readiness,
  issues,
  warnings,
  pristineHint,
  idleStatusLabel: _idleStatusLabel,
}: {
  publishMode: ComposerPublishMode;
  outcomeSentence: string;
  postStatusSummaryInline?: string;
  publishSummaryOptionsLine?: string;
  contentSummaryLines?: string[];
  contentSummaryDisplay?: "inline" | "stacked";
  sessionStrip?: PublishingSessionStripProps;
  publishPath: PublishPathSummary;
  readiness: ReadinessPresentation;
  issues: string[];
  warnings: string[];
  pristineHint?: string;
  idleStatusLabel?: string;
}) {
  void _idleStatusLabel;
  const compactIssues = compactLines(issues, ISSUE_LINE_LIMIT);
  const compactWarnings = compactLines(warnings, ISSUE_LINE_LIMIT);
  const fallbackInline =
    contentSummaryLines.length > 0
      ? contentSummaryLines.slice(0, 3).join(" · ")
      : null;
  const useStacked =
    contentSummaryDisplay === "stacked" && contentSummaryLines.length > 0;
  const contentValue = useStacked
    ? null
    : (postStatusSummaryInline ?? fallbackInline ?? "—");
  const outcomeLine = deriveSummaryOutcomeLine(publishMode, outcomeSentence);
  const hasBlocking = compactIssues.length > 0 || compactWarnings.length > 0;

  return (
    <div className="space-y-2">
      <RailSectionLabel>Publish summary</RailSectionLabel>
      <div className="space-y-1.5">
        {useStacked ? (
          <div className="space-y-1">
            <span className="text-muted-foreground font-medium">Content</span>
            <ul className="text-foreground list-none space-y-0.5 pl-0 text-[11px] leading-snug">
              {contentSummaryLines.map((line) => (
                <li
                  key={line}
                  className="border-border/40 border-b border-dotted pb-0.5 last:border-0"
                >
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <SummaryMetadataRow label="Content">
            {contentValue}
          </SummaryMetadataRow>
        )}
        {!useStacked && contentSummaryLines.length > 3 ? (
          <ul className="text-muted-foreground list-none space-y-0.5 pl-0 text-[10px] leading-snug">
            {contentSummaryLines.slice(3).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span className="text-muted-foreground text-[11px] font-medium">
            Delivery
          </span>
          <DestinationChips
            path={publishPath}
            onRelayClick={sessionStrip?.onRelayClick}
          />
        </div>
        {publishSummaryOptionsLine ? (
          <SummaryMetadataRow label="Options">
            {publishSummaryOptionsLine}
          </SummaryMetadataRow>
        ) : null}
      </div>

      {!hasBlocking ? (
        <div className="space-y-1 pt-1">
          {pristineHint ? (
            <p className="text-muted-foreground text-[11px] leading-snug">
              {pristineHint}
            </p>
          ) : null}
          <p className="text-foreground text-[11px] leading-snug">
            <span className="font-medium">{readiness.headline}</span>
            {outcomeLine ? (
              <span className="text-muted-foreground"> · {outcomeLine}</span>
            ) : null}
          </p>
        </div>
      ) : null}

      {compactIssues.length > 0 ? (
        <div className="border-destructive/45 bg-destructive/10 dark:bg-destructive/15 space-y-1 rounded-md border px-2.5 py-2 text-red-900 dark:border-red-900/60 dark:text-red-100">
          <p className="text-[11px] leading-snug font-semibold">
            {readiness.headline}
          </p>
          {compactIssues.map((issue) => (
            <p key={issue} className="text-[11px] leading-snug opacity-95">
              {issue}
            </p>
          ))}
        </div>
      ) : null}
      {compactWarnings.length > 0 ? (
        <div className="space-y-1 rounded-md border border-amber-200/90 bg-amber-500/10 px-2.5 py-2 text-amber-950 dark:border-amber-800 dark:text-amber-100">
          <p className="text-[11px] font-semibold">Missing requirements</p>
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

function ModeAndThreadZones({
  modeSpecificSection,
  threadSettingsSection,
}: {
  modeSpecificSection?: PublishingSummarySection;
  threadSettingsSection?: PublishingSummarySection;
}) {
  const modeLines = modeSpecificSection?.lines ?? [];
  const modeControls = modeSpecificSection?.controls;
  const hasMode = Boolean(
    modeSpecificSection && (modeLines.length > 0 || modeControls != null)
  );

  const threadLines = threadSettingsSection?.lines ?? [];
  const threadTitle = threadSettingsSection?.title;
  const threadControls = threadSettingsSection?.controls;
  const hasThread = Boolean(
    threadSettingsSection &&
    (threadLines.length > 0 ||
      threadControls != null ||
      (threadTitle != null && threadTitle.trim().length > 0))
  );

  if (!hasMode && !hasThread) return null;

  return (
    <div className="space-y-4">
      {hasMode ? (
        <div className="space-y-2">
          {modeLines.length > 0 ? (
            <div className="space-y-0.5">
              {compactLines(modeLines, SECTION_LINE_LIMIT).map((line) => (
                <p
                  key={line}
                  className="text-muted-foreground text-[11px] leading-snug"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          {modeControls ? <div>{modeControls}</div> : null}
        </div>
      ) : null}
      {hasThread ? (
        <div className="space-y-2">
          {threadTitle ? (
            <p className="text-muted-foreground text-[10px] font-medium tracking-wide uppercase">
              {threadTitle}
            </p>
          ) : null}
          {threadLines.length > 0 ? (
            <div className="space-y-0.5">
              {threadLines.map((line) => (
                <p
                  key={line}
                  className="text-muted-foreground text-[11px] leading-snug"
                >
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          {threadControls ? <div>{threadControls}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function PublishOptionsZone({
  followUp,
  followUpSection,
  recyclableControl,
}: {
  followUp?: { summaryLine: string; children: ReactNode };
  followUpSection?: PublishingSummarySection;
  recyclableControl?: PublishingRecyclableControlProps;
}) {
  if (!followUp && !followUpSection && !recyclableControl) return null;
  return (
    <div className="space-y-0">
      <RailSectionLabel>Publish options</RailSectionLabel>
      <div className="divide-border/50 divide-y">
        {followUp ? (
          <FollowUpRailCollapsible summaryLine={followUp.summaryLine}>
            {followUp.children}
          </FollowUpRailCollapsible>
        ) : followUpSection ? (
          <div className="py-2">
            <SectionBlockFallback {...followUpSection} />
          </div>
        ) : null}
        {recyclableControl ? (
          <RecyclableRailRow {...recyclableControl} />
        ) : null}
      </div>
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
  recyclableControl,
  postStatusSummaryInline,
  publishSummaryOptionsLine,
  contentSummaryLines = [],
  contentSummaryDisplay = "inline",
  publishPath,
  issues = [],
  warnings = [],
  pristineHint,
  idleStatusLabel,
}: Omit<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "onPrimaryActionBlocked"
  | "primaryActionDisabled"
  | "primaryActionLoading"
  | "primaryActionLoadingLabel"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
>) {
  const hasModeThread =
    Boolean(
      modeSpecificSection &&
      (modeSpecificSection.controls != null ||
        (modeSpecificSection.lines ?? []).length > 0)
    ) ||
    Boolean(
      threadSettingsSection &&
      (threadSettingsSection.controls != null ||
        (threadSettingsSection.lines ?? []).length > 0 ||
        (threadSettingsSection.title?.trim().length ?? 0) > 0)
    );
  const hasPublishOptions = Boolean(
    followUp != null || followUpSection != null || recyclableControl != null
  );

  return (
    <div className="flex flex-col text-xs">
      <div className="shrink-0">
        <PublishingModeFusedHeader
          publishMode={publishMode}
          onPublishModeChange={onPublishModeChange}
        />
      </div>

      <div className="divide-border/60 flex flex-col divide-y">
        {hasModeThread ? (
          <div className="px-3 py-3">
            <ModeAndThreadZones
              modeSpecificSection={modeSpecificSection}
              threadSettingsSection={threadSettingsSection}
            />
          </div>
        ) : null}

        {hasPublishOptions ? (
          <div className="px-3 py-3">
            <PublishOptionsZone
              followUp={followUp}
              followUpSection={followUpSection}
              recyclableControl={recyclableControl}
            />
          </div>
        ) : null}

        <div className="px-3 py-3">
          <PublishSummarySection
            publishMode={publishMode}
            outcomeSentence={outcomeSentence}
            postStatusSummaryInline={postStatusSummaryInline}
            publishSummaryOptionsLine={publishSummaryOptionsLine}
            contentSummaryLines={contentSummaryLines}
            contentSummaryDisplay={contentSummaryDisplay}
            sessionStrip={sessionStrip}
            publishPath={publishPath}
            readiness={readiness}
            issues={issues}
            warnings={warnings}
            pristineHint={pristineHint}
            idleStatusLabel={idleStatusLabel}
          />
        </div>
      </div>
    </div>
  );
}

function PublishingSummaryRailActions({
  primaryActionLabel,
  onPrimaryAction,
  onPrimaryActionBlocked,
  primaryActionDisabled,
  primaryActionLoading,
  primaryActionLoadingLabel,
  secondaryActionLabel,
  onSecondaryAction,
  secondaryActionDisabled,
}: Pick<
  PublishingSummaryRailProps,
  | "primaryActionLabel"
  | "onPrimaryAction"
  | "onPrimaryActionBlocked"
  | "primaryActionDisabled"
  | "primaryActionLoading"
  | "primaryActionLoadingLabel"
  | "secondaryActionLabel"
  | "onSecondaryAction"
  | "secondaryActionDisabled"
>) {
  const showLoading = Boolean(
    primaryActionLoading && primaryActionLoadingLabel
  );
  const label = showLoading ? primaryActionLoadingLabel! : primaryActionLabel;
  const primaryInert = showLoading;
  const blocked = primaryInert || Boolean(primaryActionDisabled);

  return (
    <div className="border-border/60 bg-card/80 shrink-0 overflow-hidden border-t">
      {secondaryActionLabel && onSecondaryAction ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="text-foreground hover:bg-muted/70 border-border/60 h-9 w-full rounded-none border-0 border-b bg-transparent text-[11px] font-semibold shadow-none"
          onClick={onSecondaryAction}
          disabled={secondaryActionDisabled}
        >
          {secondaryActionLabel}
        </Button>
      ) : null}
      <div className="p-0">
        <Button
          type="button"
          size="sm"
          variant="default"
          aria-disabled={blocked}
          className={cn(
            "h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none",
            blocked
              ? "bg-primary/80 text-primary-foreground hover:bg-primary/80 pointer-events-auto cursor-not-allowed opacity-95"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={() => {
            if (primaryInert) return;
            if (primaryActionDisabled) {
              onPrimaryActionBlocked?.();
              return;
            }
            onPrimaryAction();
          }}
        >
          {label}
        </Button>
      </div>
    </div>
  );
}

export function PublishingSummaryRail(props: PublishingSummaryRailProps) {
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
    recyclableControl: props.recyclableControl,
    postStatusSummaryInline: props.postStatusSummaryInline,
    publishSummaryOptionsLine: props.publishSummaryOptionsLine,
    contentSummaryLines: props.contentSummaryLines,
    contentSummaryDisplay: props.contentSummaryDisplay,
    publishPath: props.publishPath,
    issues: props.issues,
    warnings: props.warnings,
    pristineHint: props.pristineHint,
    idleStatusLabel: props.idleStatusLabel,
  };

  return (
    <aside
      className="border-border flex w-full shrink-0 flex-col bg-transparent lg:sticky lg:top-[4.75rem] lg:max-h-[calc(100vh-5.75rem)] lg:w-[312px] xl:w-[344px]"
      aria-label="Publish"
    >
      <div className="border-border bg-card flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PublishingSummaryRailBody {...bodyProps} />
        </div>
        <div className="shrink-0">
          <PublishingSummaryRailActions
            primaryActionLabel={props.primaryActionLabel}
            onPrimaryAction={props.onPrimaryAction}
            onPrimaryActionBlocked={props.onPrimaryActionBlocked}
            primaryActionDisabled={props.primaryActionDisabled}
            primaryActionLoading={props.primaryActionLoading}
            primaryActionLoadingLabel={props.primaryActionLoadingLabel}
            secondaryActionLabel={props.secondaryActionLabel}
            onSecondaryAction={props.onSecondaryAction}
            secondaryActionDisabled={props.secondaryActionDisabled}
          />
        </div>
      </div>
    </aside>
  );
}
