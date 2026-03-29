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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { BulkBatchMode } from "~/features/posts/bulk-composer/types";
import { RailFeedbackBlock } from "~/features/posts/components/publishing-rail/RailFeedbackBlock";
import type { BulkPost, RepostConditions } from "~/features/posts/types";
import { formatIntervalLabel } from "~/lib/schedule-intervals";
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

export function bulkRailValidationLines(aggregateLines: {
  cap: number;
  sched: number;
  lines: Array<{ text: string }>;
}): string[] {
  const out: string[] = [];
  if (aggregateLines.cap > 0) {
    out.push(
      `${aggregateLines.cap} missing caption${aggregateLines.cap !== 1 ? "s" : ""}`
    );
  }
  if (aggregateLines.sched > 0) {
    out.push(
      `${aggregateLines.sched} schedule issue${aggregateLines.sched !== 1 ? "s" : ""}`
    );
  }
  for (const line of aggregateLines.lines.slice(0, 6)) {
    out.push(line.text);
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
          />
        ) : (
          <div className="space-y-2">
            <p className="text-muted-foreground text-[11px] leading-snug">
              Assign a queue to all posts or pick per post on the cards.
            </p>
            <div className="flex flex-wrap gap-1">
              {queueTypes
                .filter((q) => {
                  const n = typeof q === "string" ? q : q.name;
                  return n !== "Unassigned";
                })
                .map((queue) => {
                  const queueName =
                    typeof queue === "string" ? queue : queue.name;
                  return (
                    <Button
                      key={queueName}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={isProcessing}
                      onClick={() => handleBulkQueueUpdate(queueName)}
                    >
                      Apply {queueName}
                    </Button>
                  );
                })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full text-xs"
              disabled={isProcessing || unassignedCount === 0}
              onClick={() => handleBulkQueueUpdate("unassigned")}
            >
              Clear all queues
            </Button>
          </div>
        )}
        {batchMode === "schedule" && scheduleIntervals ? (
          <div className="flex flex-wrap gap-1 pt-1">
            {scheduleIntervals.map((interval) => (
              <Button
                key={interval}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={isProcessing}
                onClick={() => handleScheduleIntervalClick(interval)}
              >
                {formatIntervalLabel(interval, { compact: true })}
              </Button>
            ))}
          </div>
        ) : null}
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
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={1}
                value={repostAllValue}
                onChange={(e) =>
                  setRepostAllValue(
                    Math.max(1, parseInt(e.target.value, 10) || 1)
                  )
                }
                className="h-9 w-20"
              />
              <select
                value={repostAllUnit}
                onChange={(e) =>
                  setRepostAllUnit(e.target.value as "hours" | "minutes")
                }
                className="border-border h-9 rounded border px-2 text-sm"
              >
                <option value="hours">hours</option>
                <option value="minutes">minutes</option>
              </select>
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

export function BulkSettingsRepostConditionsFields({
  bulkRepostConditions,
  setBulkRepostConditions,
}: {
  bulkRepostConditions: RepostConditions | null;
  setBulkRepostConditions: React.Dispatch<
    React.SetStateAction<RepostConditions | null>
  >;
}) {
  return (
    <div className="space-y-2">
      <p className="text-muted-foreground text-[11px] leading-snug">
        Only repost if original gets (all reposts)
      </p>
      <div className="grid grid-cols-2 gap-2">
        {REPOST_CONDITION_FIELDS.map(([key, label]) => (
          <div key={key} className="flex flex-col gap-0.5">
            <label className="text-muted-foreground text-[10px]">{label}</label>
            <Input
              type="number"
              min={0}
              placeholder="—"
              value={bulkRepostConditions?.[key] ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                const v =
                  raw.trim() === ""
                    ? undefined
                    : Math.max(0, parseInt(raw, 10) || 0);
                setBulkRepostConditions((prev) => {
                  if (v === undefined) {
                    const next = prev ? { ...prev } : {};
                    delete next[key];
                    return Object.keys(next).length > 0 ? next : null;
                  }
                  return { ...prev, [key]: v };
                });
              }}
              className="h-8 text-xs"
            />
          </div>
        ))}
      </div>
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
    lines: Array<{ text: string; index: number }>;
  };
}) {
  const noticeLines = bulkRailValidationLines(aggregateLines);

  return (
    <ActionRailSection className="space-y-2">
      <ActionRailLabel>Validation</ActionRailLabel>
      {validationResult.isValid ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          All checks passed.
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
              <button
                type="button"
                className="text-primary block w-full text-left text-[11px] hover:underline"
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
              </button>
            ) : null}
            {aggregateLines.sched > 0 ? (
              <button
                type="button"
                className="text-primary block w-full text-left text-[11px] hover:underline"
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
              </button>
            ) : null}
            {aggregateLines.lines.slice(0, 6).map((line) => (
              <button
                key={`${line.index}-${line.text}`}
                type="button"
                className="text-primary block w-full text-left text-[11px] hover:underline"
                onClick={() => onJumpToPost(line.index)}
              >
                {line.text}
              </button>
            ))}
          </div>
        </>
      )}
    </ActionRailSection>
  );
}

export function BulkSettingsRailReviewReadinessBlock({
  validationResult,
  postsCount,
  issueCount,
  aggregateLines,
  onJumpToPost,
}: {
  validationResult: { isValid: boolean };
  postsCount: number;
  issueCount: number;
  aggregateLines: { lines: Array<{ text: string; index: number }> };
  onJumpToPost: (index: number) => void;
}) {
  return (
    <ActionRailSection className="space-y-2">
      <ActionRailLabel>Readiness</ActionRailLabel>
      {validationResult.isValid ? (
        <p className="text-muted-foreground text-[11px] leading-snug">
          Ready to sign and schedule{" "}
          <span className="text-foreground font-medium">
            {postsCount} post{postsCount !== 1 ? "s" : ""}
          </span>
          .
        </p>
      ) : (
        <>
          <ActionRailNotice
            variant="warning"
            title="Needs attention"
            lines={[
              `${issueCount} post${issueCount !== 1 ? "s" : ""} still need fixes before signing.`,
            ]}
          />
          {aggregateLines.lines[0] != null ? (
            <Button
              type="button"
              variant="link"
              className="text-primary h-auto px-0 py-0 text-[11px]"
              onClick={() => onJumpToPost(aggregateLines.lines[0]!.index)}
            >
              Edit first issue
            </Button>
          ) : null}
        </>
      )}
    </ActionRailSection>
  );
}
