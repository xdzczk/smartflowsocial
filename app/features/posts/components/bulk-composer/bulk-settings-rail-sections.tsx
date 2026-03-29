import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";

import {
  ActionRailLabel,
  ActionRailNotice,
  ActionRailRow,
  ActionRailSection,
  RAIL_MAJOR_DIVIDE,
  RAIL_STACK_ROWS,
  RAIL_STACK_TIGHT,
  RAIL_SUMMARY_TO_FEEDBACK,
} from "~/components/action-rail";
import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { BulkBatchMode } from "~/features/posts/bulk-composer/types";
import {
  RailChip,
  RailChipGroup,
  RailFeedbackBlock,
  RailSettingsRow,
  RailSettingsValueRow,
  railFieldClassNames,
  railSelectTriggerClassNames,
} from "~/features/posts/components/publishing-rail";
import type { BulkPost, RepostConditions } from "~/features/posts/types";
import {
  INLINE_ICON_SIZE_CLASS,
  INLINE_ICON_STROKE,
} from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

import type { QueueType } from "../BulkPostCard";
import BulkPostsSchedulingPanel from "../BulkPostsSchedulingPanel";

export const REPOST_CONDITION_FIELDS = [
  ["minReactions", "Reactions"],
  ["minZaps", "Zaps"],
  ["minComments", "Comments"],
  ["minReposts", "Reposts"],
  ["minSats", "Sats"],
] as const;

/** Grouped counts only — details stay on post cards. */
export function bulkRailValidationSummaryLines(aggregate: {
  cap: number;
  sched: number;
  unassigned: number;
}): string[] {
  const out: string[] = [];
  if (aggregate.cap > 0) {
    out.push(
      `Missing caption${aggregate.cap !== 1 ? "s" : ""}: ${aggregate.cap}`
    );
  }
  if (aggregate.sched > 0) {
    out.push(
      `Schedule issue${aggregate.sched !== 1 ? "s" : ""}: ${aggregate.sched}`
    );
  }
  if (aggregate.unassigned > 0) {
    out.push(
      `Unassigned queue${aggregate.unassigned !== 1 ? "s" : ""}: ${aggregate.unassigned}`
    );
  }
  return out;
}

export function BulkSettingsRailScrollBody({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col text-xs", RAIL_MAJOR_DIVIDE)}>
      {children}
    </div>
  );
}

export function BulkSettingsRailBuildDefaultsBlock({
  batchMode,
  posts,
  setPosts,
  scheduleIntervals,
  userTimezone,
  isProcessing,
  bulkScheduleRandomWindowMinutes,
  setBulkScheduleRandomWindowMinutes,
  queueTypes,
  unassignedCount,
  handleBulkQueueUpdate,
  handleScheduleIntervalClick,
}: {
  batchMode: BulkBatchMode;
  posts: BulkPost[];
  setPosts: React.Dispatch<React.SetStateAction<BulkPost[]>>;
  scheduleIntervals: number[] | undefined;
  userTimezone: string;
  isProcessing: boolean;
  bulkScheduleRandomWindowMinutes: 0 | 5 | 10 | 15;
  setBulkScheduleRandomWindowMinutes: React.Dispatch<
    React.SetStateAction<0 | 5 | 10 | 15>
  >;
  queueTypes: QueueType[];
  unassignedCount: number;
  handleBulkQueueUpdate: (queueType: string) => void;
  handleScheduleIntervalClick: (interval: number) => void;
}) {
  return (
    <ActionRailSection>
      <ActionRailLabel>Batch defaults</ActionRailLabel>
      <div className={RAIL_STACK_ROWS}>
        {batchMode === "schedule" ? (
          <BulkPostsSchedulingPanel
            posts={posts}
            setPosts={setPosts}
            scheduleIntervals={scheduleIntervals}
            userTimezone={userTimezone}
            disabled={isProcessing}
            scheduleRandomWindowMinutes={bulkScheduleRandomWindowMinutes}
            onScheduleRandomWindowMinutesChange={
              setBulkScheduleRandomWindowMinutes
            }
            onScheduleIntervalChipClick={handleScheduleIntervalClick}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-[11px] leading-snug">
              Set all to a queue, or use Advanced on each card.
            </p>
            <RailChipGroup>
              {queueTypes
                .filter((q) => {
                  const n = typeof q === "string" ? q : q.name;
                  return n !== "Unassigned";
                })
                .map((queue) => {
                  const queueName =
                    typeof queue === "string" ? queue : queue.name;
                  return (
                    <RailChip
                      key={queueName}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        handleBulkQueueUpdate(queueName);
                      }}
                    >
                      {queueName}
                    </RailChip>
                  );
                })}
            </RailChipGroup>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              disabled={isProcessing || unassignedCount === 0}
              onClick={() => {
                handleBulkQueueUpdate("unassigned");
              }}
            >
              Clear all queues
            </Button>
          </div>
        )}
      </div>
    </ActionRailSection>
  );
}

export function BulkSettingsRailReviewDefaultsBlock({
  batchMode,
  reviewScheduleStartLabel,
  reviewScheduleIntervalLabel,
  reviewQueueDefaultLabel,
  randomizationLabel,
}: {
  batchMode: BulkBatchMode;
  reviewScheduleStartLabel: string;
  reviewScheduleIntervalLabel: string;
  reviewQueueDefaultLabel: string;
  randomizationLabel: string;
}) {
  return (
    <ActionRailSection>
      <ActionRailLabel>Batch defaults</ActionRailLabel>
      <div className={RAIL_STACK_ROWS}>
        {batchMode === "schedule" ? (
          <>
            <ActionRailRow label="Start" value={reviewScheduleStartLabel} />
            <ActionRailRow
              label="Interval"
              value={reviewScheduleIntervalLabel}
            />
            <ActionRailRow label="Randomization" value={randomizationLabel} />
          </>
        ) : (
          <>
            <ActionRailRow
              label="Default queue"
              value={reviewQueueDefaultLabel}
            />
            <ActionRailRow label="Randomization" value={randomizationLabel} />
          </>
        )}
      </div>
    </ActionRailSection>
  );
}

export function BulkSettingsRepostAllPopover({
  isProcessing,
  repostAllOpen,
  setRepostAllOpen,
  repostAllValue,
  setRepostAllValue,
  repostAllUnit,
  setRepostAllUnit,
  onRepostAll,
}: {
  isProcessing: boolean;
  repostAllOpen: boolean;
  setRepostAllOpen: (open: boolean) => void;
  repostAllValue: number;
  setRepostAllValue: React.Dispatch<React.SetStateAction<number>>;
  repostAllUnit: "hours" | "minutes";
  setRepostAllUnit: React.Dispatch<React.SetStateAction<"hours" | "minutes">>;
  onRepostAll: (delay: { value: number; unit: "hours" | "minutes" }) => void;
}) {
  return (
    <div className="mb-2">
      <Popover open={repostAllOpen} onOpenChange={setRepostAllOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-full text-xs"
            disabled={isProcessing}
          >
            Repost all (delay)
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="start">
          <div className="space-y-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-muted-foreground text-xs">Delay</Label>
                <Input
                  type="number"
                  min={1}
                  value={repostAllValue}
                  onChange={(e) =>
                    setRepostAllValue(
                      Math.max(1, parseInt(e.target.value, 10) || 1)
                    )
                  }
                  className={cn(railFieldClassNames, "h-9 w-20")}
                />
              </div>
              <div className="flex min-w-[7rem] flex-col gap-1">
                <Label className="text-muted-foreground text-xs">Unit</Label>
                <Select
                  value={repostAllUnit}
                  onValueChange={(v) =>
                    setRepostAllUnit(v as "hours" | "minutes")
                  }
                >
                  <SelectTrigger
                    className={cn(railSelectTriggerClassNames, "h-9")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="minutes">Minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={() => {
                onRepostAll({ value: repostAllValue, unit: repostAllUnit });
                setRepostAllOpen(false);
              }}
            >
              Apply to all
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function repostThresholdsSummary(
  bulkRepostConditions: RepostConditions | null
): string {
  if (!bulkRepostConditions) return "None";
  let active = 0;
  for (const [key] of REPOST_CONDITION_FIELDS) {
    const k = key as keyof RepostConditions;
    const v = bulkRepostConditions[k];
    if (typeof v === "number" && v > 0) active += 1;
  }
  if (active === 0) return "None";
  return `${active} active`;
}

export function BulkSettingsRepostConditionsFields({
  bulkRepostConditions,
  setBulkRepostConditions,
}: {
  bulkRepostConditions: RepostConditions | null;
  setBulkRepostConditions: React.Dispatch<
    React.SetStateAction<RepostConditions | null>
  >;
}) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(
    () => repostThresholdsSummary(bulkRepostConditions),
    [bulkRepostConditions]
  );

  return (
    <div className="w-full">
      <RailSettingsValueRow
        label="Repost thresholds"
        value={summary}
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
        <div className="divide-border/60 border-border/50 mt-2 space-y-2 border-t pt-2">
          <p className="text-muted-foreground text-[10px] leading-snug">
            Only repost if the original reaches these minimums (all reposts in
            this batch).
          </p>
          {REPOST_CONDITION_FIELDS.map(([key, label]) => {
            const fieldKey = key as keyof RepostConditions;
            const inputId = `bulk-rail-repost-${key}`;
            return (
              <RailSettingsRow
                key={key}
                labelFor={inputId}
                label={label}
                control={
                  <Input
                    id={inputId}
                    type="number"
                    min={0}
                    placeholder="—"
                    inputMode="numeric"
                    value={bulkRepostConditions?.[fieldKey] ?? ""}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const v =
                        raw.trim() === ""
                          ? undefined
                          : Math.max(0, parseInt(raw, 10) || 0);
                      setBulkRepostConditions((prev) => {
                        if (v === undefined) {
                          const next = prev ? { ...prev } : {};
                          delete next[fieldKey];
                          return Object.keys(next).length > 0 ? next : null;
                        }
                        return { ...prev, [fieldKey]: v };
                      });
                    }}
                    className={cn(
                      railFieldClassNames,
                      "h-8 w-[4.5rem] text-xs tabular-nums"
                    )}
                  />
                }
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function BulkSettingsRailBuildOptionsBlock({
  posts,
  isProcessing,
  onRepostAll,
  repostAllOpen,
  setRepostAllOpen,
  repostAllValue,
  setRepostAllValue,
  repostAllUnit,
  setRepostAllUnit,
  showRepostConditions,
  bulkRepostConditions,
  setBulkRepostConditions,
  hashTagPresets,
  selectedHashtagPresetId,
  handleHashtagPresetSelect,
  useHashtagPresets,
  setUseHashtagPresets,
  handleBulkRecyclableToggle,
}: {
  posts: BulkPost[];
  isProcessing: boolean;
  onRepostAll?: (delay: { value: number; unit: "hours" | "minutes" }) => void;
  repostAllOpen: boolean;
  setRepostAllOpen: (open: boolean) => void;
  repostAllValue: number;
  setRepostAllValue: React.Dispatch<React.SetStateAction<number>>;
  repostAllUnit: "hours" | "minutes";
  setRepostAllUnit: React.Dispatch<React.SetStateAction<"hours" | "minutes">>;
  showRepostConditions: boolean;
  bulkRepostConditions: RepostConditions | null;
  setBulkRepostConditions: React.Dispatch<
    React.SetStateAction<RepostConditions | null>
  >;
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  selectedHashtagPresetId: string | null;
  handleHashtagPresetSelect: (
    presetId: string | null,
    hashtags: string
  ) => void;
  useHashtagPresets: boolean;
  setUseHashtagPresets: (v: boolean) => void;
  handleBulkRecyclableToggle: () => void;
}) {
  return (
    <ActionRailSection>
      <ActionRailLabel>Batch options</ActionRailLabel>
      <div className={RAIL_STACK_ROWS}>
        {onRepostAll ? (
          <BulkSettingsRepostAllPopover
            isProcessing={isProcessing}
            repostAllOpen={repostAllOpen}
            setRepostAllOpen={setRepostAllOpen}
            repostAllValue={repostAllValue}
            setRepostAllValue={setRepostAllValue}
            repostAllUnit={repostAllUnit}
            setRepostAllUnit={setRepostAllUnit}
            onRepostAll={onRepostAll}
          />
        ) : null}
        {showRepostConditions ? (
          <BulkSettingsRepostConditionsFields
            bulkRepostConditions={bulkRepostConditions}
            setBulkRepostConditions={setBulkRepostConditions}
          />
        ) : null}
        <HashtagPresetToggle
          presets={hashTagPresets.map((p) => ({
            id: p.id,
            name: p.name,
            tags: p.tags,
          }))}
          selectedPresetId={selectedHashtagPresetId}
          onSelect={handleHashtagPresetSelect}
          disabled={isProcessing}
          useHashtagPresets={useHashtagPresets}
          onUseHashtagPresetsChange={setUseHashtagPresets}
          showQueuePreset={false}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full text-xs"
          disabled={isProcessing}
          onClick={handleBulkRecyclableToggle}
        >
          {posts.every((p) => p.isRecyclable)
            ? "Mark all non-recyclable"
            : "Mark all recyclable"}
        </Button>
      </div>
    </ActionRailSection>
  );
}

export function BulkSettingsRailReviewBatchOptionsBlock({
  posts,
  useHashtagPresets,
}: {
  posts: BulkPost[];
  useHashtagPresets: boolean;
}) {
  return (
    <ActionRailSection>
      <ActionRailLabel>Batch options</ActionRailLabel>
      <div className={RAIL_STACK_ROWS}>
        <ActionRailRow
          label="Hashtag presets"
          value={useHashtagPresets ? "On" : "Off"}
        />
        <ActionRailRow
          label="Recyclable"
          value={posts.every((p) => p.isRecyclable) ? "All on" : "Mixed"}
        />
      </div>
    </ActionRailSection>
  );
}

export function BulkSettingsRailSummaryBlock({
  postsCount,
  readyCount,
  issueCount,
  unassignedCount,
  reviewSummaryRows,
}: {
  postsCount: number;
  readyCount: number;
  issueCount: number;
  unassignedCount: number;
  reviewSummaryRows: Array<{ label: string; value: string }>;
}) {
  return (
    <ActionRailSection>
      <ActionRailLabel>Summary</ActionRailLabel>
      <div className={RAIL_STACK_ROWS}>
        <ActionRailRow label="Total posts" value={String(postsCount)} />
        <ActionRailRow label="Ready" value={String(readyCount)} />
        <ActionRailRow
          label="Needs attention"
          value={String(Math.max(0, issueCount))}
        />
        <ActionRailRow
          label="Unassigned queue"
          value={String(unassignedCount)}
        />
        {reviewSummaryRows.map((row) => (
          <ActionRailRow key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </ActionRailSection>
  );
}

export function BulkSettingsRailBuildValidationBlock({
  validationResult,
  posts,
  onJumpToPost,
  aggregateLines,
  postsCount,
  batchMode,
}: {
  validationResult: {
    isValid: boolean;
    byPost: Record<number, string[]>;
  };
  posts: BulkPost[];
  onJumpToPost: (index: number) => void;
  aggregateLines: {
    cap: number;
    sched: number;
    unassigned: number;
  };
  postsCount: number;
  batchMode: BulkBatchMode;
}) {
  const noticeLines = bulkRailValidationSummaryLines(aggregateLines);

  if (postsCount === 0) {
    return (
      <ActionRailSection className="space-y-2">
        <ActionRailLabel>Validation</ActionRailLabel>
        <p className="text-muted-foreground text-[11px] leading-snug">
          Add posts to validate this batch.
        </p>
      </ActionRailSection>
    );
  }

  return (
    <ActionRailSection className="space-y-2">
      <ActionRailLabel>Validation</ActionRailLabel>
      {validationResult.isValid ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          Ready to review.
        </p>
      ) : (
        <>
          {noticeLines.length > 0 ? (
            <RailFeedbackBlock
              variant="warning"
              title="Missing requirements"
              lines={noticeLines}
            />
          ) : null}
          <div className={cn(RAIL_STACK_TIGHT, RAIL_SUMMARY_TO_FEEDBACK)}>
            {aggregateLines.cap > 0 ? (
              <Button
                type="button"
                variant="link"
                className="text-primary h-auto justify-start px-0 py-0 text-[11px]"
                onClick={() => {
                  const idx = posts.findIndex((_, i) =>
                    validationResult.byPost[i]?.some((e) =>
                      e.includes("Caption")
                    )
                  );
                  if (idx >= 0) onJumpToPost(idx);
                }}
              >
                Jump to first missing caption
              </Button>
            ) : null}
            {aggregateLines.sched > 0 ? (
              <Button
                type="button"
                variant="link"
                className="text-primary h-auto justify-start px-0 py-0 text-[11px]"
                onClick={() => {
                  const idx = posts.findIndex((_, i) =>
                    validationResult.byPost[i]?.some((e) =>
                      e.includes("Schedule")
                    )
                  );
                  if (idx >= 0) onJumpToPost(idx);
                }}
              >
                Jump to first schedule issue
              </Button>
            ) : null}
            {batchMode === "queue" && aggregateLines.unassigned > 0 ? (
              <Button
                type="button"
                variant="link"
                className="text-primary h-auto justify-start px-0 py-0 text-[11px]"
                onClick={() => {
                  const idx = posts.findIndex(
                    (p) => !p.queueType || p.queueType === "unassigned"
                  );
                  if (idx >= 0) onJumpToPost(idx);
                }}
              >
                Jump to first unassigned queue
              </Button>
            ) : null}
          </div>
        </>
      )}
    </ActionRailSection>
  );
}

function firstBulkIssuePostIndex(
  posts: BulkPost[],
  validationResult: { byPost: Record<number, string[]> },
  batchMode: BulkBatchMode
): number {
  const capIdx = posts.findIndex((_, i) =>
    validationResult.byPost[i]?.some((e) => e.includes("Caption"))
  );
  if (capIdx >= 0) return capIdx;
  const schedIdx = posts.findIndex((_, i) =>
    validationResult.byPost[i]?.some((e) => e.includes("Schedule"))
  );
  if (schedIdx >= 0) return schedIdx;
  if (batchMode === "queue") {
    const qIdx = posts.findIndex(
      (p) => !p.queueType || p.queueType === "unassigned"
    );
    if (qIdx >= 0) return qIdx;
  }
  return -1;
}

export function BulkSettingsRailReviewReadinessBlock({
  validationResult,
  postsCount,
  issueCount,
  posts,
  batchMode,
  onJumpToPost,
}: {
  validationResult: { isValid: boolean; byPost: Record<number, string[]> };
  postsCount: number;
  issueCount: number;
  posts: BulkPost[];
  batchMode: BulkBatchMode;
  onJumpToPost: (index: number) => void;
}) {
  const firstIssue = firstBulkIssuePostIndex(
    posts,
    validationResult,
    batchMode
  );

  if (postsCount === 0) {
    return (
      <ActionRailSection className="space-y-2">
        <ActionRailLabel>Readiness</ActionRailLabel>
        <p className="text-muted-foreground text-[11px] leading-snug">
          Add posts to see signing readiness.
        </p>
      </ActionRailSection>
    );
  }

  return (
    <ActionRailSection className="space-y-2">
      <ActionRailLabel>Readiness</ActionRailLabel>
      {validationResult.isValid ? (
        <p className="text-foreground text-[11px] leading-snug font-medium">
          Ready to sign and schedule {postsCount} post
          {postsCount !== 1 ? "s" : ""}.
        </p>
      ) : (
        <>
          <ActionRailNotice
            variant="warning"
            title="Needs attention"
            lines={[
              `${issueCount} post${issueCount !== 1 ? "s" : ""} need fixes before signing.`,
            ]}
          />
          {firstIssue >= 0 ? (
            <Button
              type="button"
              variant="link"
              className="text-primary h-auto justify-start px-0 py-0 text-[11px]"
              onClick={() => onJumpToPost(firstIssue)}
            >
              Jump to first issue
            </Button>
          ) : null}
        </>
      )}
    </ActionRailSection>
  );
}
