/**
 * Composer publish rail: delivery, validation, and primary publish actions.
 * Main composer column = what you publish; this rail = how and when it ships.
 * New controls: classify as content (main) vs delivery (here) before placing UI.
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
  /** Distribution: optional delivery extras (grouped with follow-up below). */
  recyclableControl?: PublishingRecyclableControlProps;
  /** Single-line content metrics for Ready check (chars · media · tags, etc.). */
  postStatusSummaryInline?: string;
  /** Follow-up + Recyclable (and similar) for Ready check options row. */
  publishSummaryOptionsLine?: string;
  /** Extra detail lines under Content row (e.g. thread cadence). */
  contentSummaryLines?: string[];
  publishPath: PublishPathSummary;
  issues?: string[];
  warnings?: string[];
  /** Neutral hint when the composer is pristine but not yet publishable (no red). */
  pristineHint?: string;
  /** Badge label when there are no red/amber issue rows (e.g. "Draft" vs "Ready"). */
  idleStatusLabel?: string;
  /** When `sessionStrip` is omitted, passive save text under Save draft. */
  saveStateLabel?: string;
  primaryActionLabel: string;
  onPrimaryAction: () => void;
  /** Fires when the user activates the primary control while `primaryActionDisabled` (progressive validation). */
  onPrimaryActionBlocked?: () => void;
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

/** Outcome line above Save draft / CTA — single consequence-focused sentence. */
function deriveActionSummary(
  publishMode: ComposerPublishMode,
  outcomeSentence: string
): string {
  const s = outcomeSentence.trim();
  if (!s) {
    return publishMode === "schedule"
      ? "Set a publish time to continue"
      : publishMode === "queue"
        ? "Choose a queue to continue"
        : "Content required to publish";
  }
  return s.replace(/\.\s*$/, "");
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
      className="border-border/60 divide-border/60 grid grid-cols-3 divide-x"
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
              "min-h-[44px] px-1 py-2.5 text-center text-xs transition-colors",
              active
                ? "bg-card text-foreground relative z-[1] -mb-px border-b border-b-transparent font-semibold"
                : "text-muted-foreground hover:text-foreground border-border/60 border-b font-medium"
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
    <div>
      <button
        type="button"
        className="hover:bg-muted/30 flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left text-xs"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-foreground shrink-0 font-medium">Follow-up</span>
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
        <div className="border-border/50 mt-1 border-t pt-1.5 pl-1">
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
    <div className="flex flex-col gap-0.5 px-1 py-0.5">
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
        <p className="text-muted-foreground pl-0 text-[10px] leading-snug">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

function DeliveryOptionsSection({
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
    <div className="border-border/60 rounded-md border px-2 py-1.5">
      <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase">
        Delivery options
      </p>
      <div className="space-y-0.5">
        {followUp ? (
          <FollowUpRailCollapsible summaryLine={followUp.summaryLine}>
            {followUp.children}
          </FollowUpRailCollapsible>
        ) : followUpSection ? (
          <SectionBlock {...followUpSection} />
        ) : null}
        {recyclableControl ? (
          <RecyclableRailRow {...recyclableControl} />
        ) : null}
      </div>
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
    <div className="bg-muted/[0.06] rounded-md px-2 py-1">
      {title ? (
        <span className="text-muted-foreground text-xs font-medium">
          {title}
        </span>
      ) : null}
      <div className={title ? "mt-0.5 space-y-0.5" : "space-y-0.5"}>
        {compacted.map((line) => (
          <p key={line} className="text-xs leading-snug">
            {line}
          </p>
        ))}
        {controls ? <div className="pt-0.5">{controls}</div> : null}
      </div>
    </div>
  );
}

function ReadyCheckRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="text-[11px] leading-snug">
      <span className="text-muted-foreground font-medium">{label}:</span>{" "}
      <span className="text-foreground">{children}</span>
    </div>
  );
}

function PostStatusBlock({
  postStatusSummaryInline,
  publishSummaryOptionsLine,
  contentSummaryLines = [],
  sessionStrip,
  publishPath,
  readiness,
  issues,
  warnings,
  pristineHint,
  idleStatusLabel,
}: {
  postStatusSummaryInline?: string;
  publishSummaryOptionsLine?: string;
  contentSummaryLines?: string[];
  sessionStrip?: PublishingSessionStripProps;
  publishPath: PublishPathSummary;
  readiness: ReadinessPresentation;
  issues: string[];
  warnings: string[];
  pristineHint?: string;
  idleStatusLabel?: string;
}) {
  const compactIssues = compactLines(issues, ISSUE_LINE_LIMIT);
  const compactWarnings = compactLines(warnings, ISSUE_LINE_LIMIT);
  const fallbackInline =
    contentSummaryLines.length > 0
      ? contentSummaryLines.slice(0, 3).join(" · ")
      : null;
  const contentValue = postStatusSummaryInline ?? fallbackInline ?? "—";

  return (
    <div className="border-border/60 rounded-md border px-2 py-1.5">
      <p className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wide uppercase">
        Ready check
      </p>
      <div className="space-y-1">
        <ReadyCheckRow label="Content">{contentValue}</ReadyCheckRow>
        {contentSummaryLines.length > 3 ? (
          <ul className="text-muted-foreground ml-0 list-none space-y-0.5 pl-0 text-[10px] leading-snug">
            {contentSummaryLines.slice(3).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
          <span className="text-muted-foreground text-[11px] font-medium">
            Delivery:
          </span>
          <DestinationChips
            path={publishPath}
            onRelayClick={sessionStrip?.onRelayClick}
          />
        </div>
        {publishSummaryOptionsLine ? (
          <ReadyCheckRow label="Options">
            {publishSummaryOptionsLine}
          </ReadyCheckRow>
        ) : null}
      </div>
      {compactIssues.length === 0 && compactWarnings.length === 0 ? (
        <div className="border-border/50 mt-1.5 space-y-1 border-t pt-1.5">
          {pristineHint ? (
            <p className="text-muted-foreground text-[11px] leading-snug">
              {pristineHint}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="font-normal">
              {idleStatusLabel ??
                (readiness.tone === "ok" ? "Ready" : readiness.headline)}
            </Badge>
            {readiness.tone === "ok" && !pristineHint ? (
              <span className="text-muted-foreground text-[11px]">
                No blocking issues
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
      {compactIssues.length > 0 ? (
        <div className="border-destructive/40 bg-destructive/8 dark:bg-destructive/12 mt-1.5 space-y-1 rounded-md border px-2 py-1.5 text-red-900 dark:border-red-900/70 dark:text-red-100">
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
        <div className="mt-1.5 space-y-1 rounded-md border border-amber-200/90 bg-amber-500/10 px-2 py-1.5 text-amber-950 dark:border-amber-800 dark:text-amber-100">
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

function PublishingSummaryRailBody({
  publishMode,
  onPublishModeChange,
  outcomeSentence: _outcomeSentence,
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
  | "saveStateLabel"
>) {
  void _outcomeSentence;
  return (
    <div className="flex flex-col gap-0 text-xs">
      <PublishingModeFusedHeader
        publishMode={publishMode}
        onPublishModeChange={onPublishModeChange}
      />
      <div className="space-y-1.5 px-2.5 py-1.5">
        {modeSpecificSection ? (
          <SectionBlock
            title=""
            lines={modeSpecificSection.lines}
            controls={modeSpecificSection.controls}
          />
        ) : null}
        {threadSettingsSection ? (
          <SectionBlock {...threadSettingsSection} />
        ) : null}
        <DeliveryOptionsSection
          followUp={followUp}
          followUpSection={followUpSection}
          recyclableControl={recyclableControl}
        />
        <PostStatusBlock
          postStatusSummaryInline={postStatusSummaryInline}
          publishSummaryOptionsLine={publishSummaryOptionsLine}
          contentSummaryLines={contentSummaryLines}
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
  );
}

function PublishingSummaryRailActions({
  actionSummary,
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
> & { actionSummary: string }) {
  const showLoading = Boolean(
    primaryActionLoading && primaryActionLoadingLabel
  );
  const label = showLoading ? primaryActionLoadingLabel! : primaryActionLabel;
  const primaryInert = showLoading;

  return (
    <div className="border-border/60 shrink-0 overflow-hidden border-t">
      <div className="text-muted-foreground border-border/60 border-b px-3 py-2 text-[11px] leading-snug">
        {actionSummary}
      </div>
      {secondaryActionLabel && onSecondaryAction ? (
        <div className="border-border/60 bg-background border-b">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="text-foreground hover:bg-muted/60 h-9 w-full rounded-none border-0 bg-transparent text-[11px] leading-none font-semibold shadow-none"
            onClick={onSecondaryAction}
            disabled={secondaryActionDisabled}
          >
            {secondaryActionLabel}
          </Button>
        </div>
      ) : null}
      <div className="bg-primary/95 p-0">
        <Button
          type="button"
          size="sm"
          variant="default"
          aria-disabled={primaryInert || Boolean(primaryActionDisabled)}
          className={cn(
            "bg-primary text-primary-foreground hover:bg-primary/90 h-12 w-full rounded-none rounded-b-xl border-0 text-xs font-semibold shadow-none",
            (primaryInert || primaryActionDisabled) &&
              "pointer-events-auto opacity-60"
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
  const actionSummary = deriveActionSummary(
    props.publishMode,
    props.outcomeSentence
  );

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
    publishPath: props.publishPath,
    issues: props.issues,
    warnings: props.warnings,
    pristineHint: props.pristineHint,
    idleStatusLabel: props.idleStatusLabel,
  };

  return (
    <aside
      className="border-border flex w-full shrink-0 flex-col bg-transparent lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:w-[312px] xl:w-[344px]"
      aria-label="Publish"
    >
      <div className="border-border bg-card flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto">
          <PublishingSummaryRailBody {...bodyProps} />
        </div>
        <div className="shrink-0">
          <PublishingSummaryRailActions
            actionSummary={actionSummary}
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
