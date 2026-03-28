/**
 * Composer publish rail: delivery, validation, and primary publish actions.
 * Publishing Rail V4: shared tokens and primitives (publishing-rail/).
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import type { ComposerStatus } from "~/features/posts/components/NewPostHeader";
import {
  RailFeedbackBlock,
  RailSectionHeader,
  RailSegmentedTabs,
  RailSettingsRow,
  RailSettingsValueRow,
  RailSummaryDeliveryRow,
  RailSummaryMetadataRow,
  RailSummaryOutcomeBlock,
  RailSummaryToken,
  RAIL_MAJOR_DIVIDE,
  RAIL_MODE_THREAD_GAP,
  RAIL_PAD_X,
  RAIL_SECONDARY_ACTION,
  RAIL_STACK_ROWS,
  RAIL_STACK_TIGHT,
  RAIL_SUMMARY_TO_FEEDBACK,
  RAIL_ZONE_PY,
} from "~/features/posts/components/publishing-rail";
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
  /** Optional secondary line (e.g. tags) with muted summary typography */
  publishSummaryTagsLine?: string;
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
      <RailSettingsValueRow
        label="Follow-up"
        value={summaryLine}
        onClick={() => setOpen((o) => !o)}
        ariaExpanded={open}
        trailing={
          open ? (
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
          )
        }
      />
      {open ? (
        <div className="divide-border/60 border-border/50 mt-1 border-t pt-2 pl-0">
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
    <RailSettingsRow
      labelFor={switchId}
      label={label}
      helperText={helperText}
      control={
        <Switch
          id={switchId}
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      }
    />
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
    <div className={RAIL_STACK_TIGHT}>
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

function PublishSummarySection({
  publishMode,
  outcomeSentence,
  postStatusSummaryInline,
  publishSummaryTagsLine,
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
  publishSummaryTagsLine?: string;
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
    <div className={RAIL_STACK_ROWS}>
      <RailSectionHeader>Publish summary</RailSectionHeader>
      <div className={RAIL_STACK_ROWS}>
        {useStacked ? (
          <div className={RAIL_STACK_TIGHT}>
            <span className="text-muted-foreground text-[11px] font-medium">
              Content
            </span>
            <ul className="text-foreground list-none space-y-0.5 pl-0 text-[11px] leading-snug">
              {contentSummaryLines.map((line) => {
                const isTags = /^tags:/i.test(line.trim());
                return (
                  <li
                    key={line}
                    className={cn(
                      "border-border/40 border-b border-dotted pb-0.5 last:border-0",
                      isTags && "text-muted-foreground"
                    )}
                  >
                    {line}
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <RailSummaryMetadataRow label="Content">
            {contentValue}
          </RailSummaryMetadataRow>
        )}
        {!useStacked && contentSummaryLines.length > 3 ? (
          <ul className="text-muted-foreground list-none space-y-0.5 pl-0 text-[10px] leading-snug">
            {contentSummaryLines.slice(3).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {publishSummaryTagsLine ? (
          <RailSummaryMetadataRow label="Tags" secondary>
            {publishSummaryTagsLine}
          </RailSummaryMetadataRow>
        ) : null}
        <RailSummaryDeliveryRow>
          <RailSummaryToken
            onClick={sessionStrip?.onRelayClick}
            className="max-w-[min(100%,12rem)]"
          >
            {publishPath.relayCount} relay
            {publishPath.relayCount !== 1 ? "s" : ""}
          </RailSummaryToken>
          {publishPath.queueLabel ? (
            <RailSummaryToken className="max-w-[min(100%,12rem)]">
              {publishPath.queueLabel}
            </RailSummaryToken>
          ) : null}
        </RailSummaryDeliveryRow>
        {publishSummaryOptionsLine ? (
          <RailSummaryMetadataRow label="Options">
            {publishSummaryOptionsLine}
          </RailSummaryMetadataRow>
        ) : null}
      </div>

      {!hasBlocking ? (
        <RailSummaryOutcomeBlock
          className={RAIL_SUMMARY_TO_FEEDBACK}
          headline={readiness.headline}
          outcomeLine={outcomeLine || null}
          pristineHint={pristineHint ?? null}
        />
      ) : null}

      {compactIssues.length > 0 ? (
        <RailFeedbackBlock
          className={RAIL_SUMMARY_TO_FEEDBACK}
          variant="error"
          title={readiness.headline}
          lines={compactIssues}
        />
      ) : null}
      {compactWarnings.length > 0 ? (
        <RailFeedbackBlock
          className={RAIL_SUMMARY_TO_FEEDBACK}
          variant="warning"
          title="Missing requirements"
          lines={compactWarnings}
        />
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
    <div className={RAIL_MODE_THREAD_GAP}>
      {hasMode ? (
        <div className={RAIL_STACK_ROWS}>
          {modeLines.length > 0 ? (
            <div className={RAIL_STACK_TIGHT}>
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
        <div className={RAIL_STACK_ROWS}>
          {threadTitle ? (
            <RailSectionHeader>{threadTitle}</RailSectionHeader>
          ) : null}
          {threadLines.length > 0 ? (
            <div className={RAIL_STACK_TIGHT}>
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
    <div>
      <RailSectionHeader>Publish options</RailSectionHeader>
      <div className="divide-border/60 divide-y">
        {followUp ? (
          <FollowUpRailCollapsible summaryLine={followUp.summaryLine}>
            {followUp.children}
          </FollowUpRailCollapsible>
        ) : followUpSection ? (
          <div className="py-2.5">
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
  publishSummaryTagsLine,
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

  const zoneClass = cn(RAIL_PAD_X, RAIL_ZONE_PY);

  return (
    <div className="flex flex-col text-xs">
      <div className="shrink-0">
        <RailSegmentedTabs
          value={publishMode}
          onValueChange={onPublishModeChange}
        />
      </div>

      <div className={cn("flex flex-col", RAIL_MAJOR_DIVIDE)}>
        {hasModeThread ? (
          <div className={zoneClass}>
            <ModeAndThreadZones
              modeSpecificSection={modeSpecificSection}
              threadSettingsSection={threadSettingsSection}
            />
          </div>
        ) : null}

        {hasPublishOptions ? (
          <div className={zoneClass}>
            <PublishOptionsZone
              followUp={followUp}
              followUpSection={followUpSection}
              recyclableControl={recyclableControl}
            />
          </div>
        ) : null}

        <div className={zoneClass}>
          <PublishSummarySection
            publishMode={publishMode}
            outcomeSentence={outcomeSentence}
            postStatusSummaryInline={postStatusSummaryInline}
            publishSummaryTagsLine={publishSummaryTagsLine}
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
          variant="ghost"
          size="sm"
          className={RAIL_SECONDARY_ACTION}
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
    publishSummaryTagsLine: props.publishSummaryTagsLine,
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
