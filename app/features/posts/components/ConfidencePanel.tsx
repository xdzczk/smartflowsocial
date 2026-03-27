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
  /** Shown under system chips (e.g. Recyclable on/off). */
  postStatusRecyclableMeta?: string;
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
      className="border-border/80 bg-muted/25 grid grid-cols-3 overflow-hidden border-b"
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
              "border-border/70 min-h-[44px] border-r px-1 py-2.5 text-center text-xs transition-colors last:border-r-0",
              active
                ? "bg-card text-foreground relative z-[1] -mb-px border-b border-b-transparent font-semibold"
                : "text-muted-foreground bg-muted/20 hover:bg-muted/45 hover:text-foreground"
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

function formatSignerChipLabel(signerLabel: string | null): string {
  const s = signerLabel?.trim();
  if (!s) return "Signer —";
  if (s === "NIP-07" || s.toLowerCase().includes("nip-07")) {
    return "NIP-07 extension";
  }
  return s;
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
        {formatSignerChipLabel(path.signerLabel)}
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
    <div className="border-border/70 bg-muted/[0.04] rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/25 flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span className="text-foreground shrink-0 font-medium">
          Follow-up actions
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
        <div className="border-border/70 border-t px-2.5 py-1.5">
          {children}
        </div>
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
    <div className="bg-muted/[0.06] rounded-lg px-2.5 py-1.5">
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
        {controls ? <div className="pt-1">{controls}</div> : null}
      </div>
    </div>
  );
}

function PostStatusBlock({
  postStatusSummaryInline,
  postStatusRecyclableMeta,
  contentSummaryLines = [],
  sessionStrip,
  publishPath,
  readiness,
  issues,
  warnings,
}: {
  postStatusSummaryInline?: string;
  postStatusRecyclableMeta?: string;
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
    <div className="border-border/70 bg-muted/[0.03] rounded-lg border px-2.5 py-2">
      <p className="text-muted-foreground mb-2 text-xs font-medium">
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
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
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
      {postStatusRecyclableMeta ? (
        <p className="text-muted-foreground mb-1.5 text-[11px] leading-snug opacity-85">
          {postStatusRecyclableMeta}
        </p>
      ) : null}
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
        <div className="mt-1.5 space-y-1 rounded-lg border border-red-300/85 bg-red-500/[0.08] px-2.5 py-1.5 text-xs text-red-800 dark:border-red-900/80 dark:text-red-200">
          <p className="leading-snug font-semibold">{readiness.headline}</p>
          {compactIssues.map((issue) => (
            <p key={issue} className="text-[11px] leading-snug opacity-95">
              {issue}
            </p>
          ))}
        </div>
      ) : null}
      {compactWarnings.length > 0 ? (
        <div className="mt-1.5 space-y-1 rounded-lg border border-amber-200/90 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-900 dark:border-amber-800 dark:text-amber-200">
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
  postStatusRecyclableMeta,
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
    <div className="flex flex-col gap-0 text-xs">
      <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
        <PublishingModeFusedHeader
          publishMode={publishMode}
          onPublishModeChange={onPublishModeChange}
        />
        <div className="bg-card px-3 py-2.5">
          <p className="text-foreground text-sm leading-snug font-medium">
            {outcomeSentence}
          </p>
        </div>
        <div className="border-border/60 space-y-2.5 border-t px-3 py-2.5">
          {threadSettingsSection ? (
            <SectionBlock {...threadSettingsSection} />
          ) : null}
          {modeSpecificSection ? (
            <SectionBlock {...modeSpecificSection} />
          ) : null}
          {followUp ? (
            <FollowUpRailCollapsible summaryLine={followUp.summaryLine}>
              {followUp.children}
            </FollowUpRailCollapsible>
          ) : followUpSection ? (
            <SectionBlock {...followUpSection} />
          ) : null}
          <PostStatusBlock
            postStatusSummaryInline={postStatusSummaryInline}
            postStatusRecyclableMeta={postStatusRecyclableMeta}
            contentSummaryLines={contentSummaryLines}
            sessionStrip={sessionStrip}
            publishPath={publishPath}
            readiness={readiness}
            issues={issues}
            warnings={warnings}
          />
        </div>
      </div>
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
    <div className="border-border/70 mt-1.5 shrink-0 overflow-hidden rounded-xl border">
      {secondaryActionLabel && onSecondaryAction ? (
        <div className="border-border/70 bg-muted/20 space-y-0.5 border-b px-2.5 py-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-border/70 h-9 w-full text-xs font-medium"
            onClick={onSecondaryAction}
            disabled={secondaryActionDisabled}
          >
            {secondaryActionLabel}
          </Button>
          {footerSaveHelper ? (
            <p className="text-muted-foreground/80 text-center text-[10px] leading-snug">
              {footerSaveHelper}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="bg-primary/95 p-1.5">
        <Button
          type="button"
          size="sm"
          variant="default"
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-11 w-full border-0 text-xs font-semibold shadow-none"
          onClick={onPrimaryAction}
          disabled={Boolean(primaryActionDisabled) || showLoading}
        >
          {label}
        </Button>
      </div>
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
    postStatusRecyclableMeta: props.postStatusRecyclableMeta,
    contentSummaryLines: props.contentSummaryLines,
    publishPath: props.publishPath,
    issues: props.issues,
    warnings: props.warnings,
  };

  return (
    <>
      <aside
        className="border-border hidden w-72 shrink-0 self-start bg-transparent lg:sticky lg:top-16 lg:flex lg:max-h-[calc(100vh-5rem)] lg:flex-col xl:w-80"
        aria-label="Publish"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-0.5 pr-1">
          <PublishingSummaryRailBody {...bodyProps} />
        </div>
        <div className="shrink-0 px-0.5">
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
        </div>
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
