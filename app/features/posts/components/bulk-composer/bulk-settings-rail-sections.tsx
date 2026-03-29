import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type {
  BulkBatchMode,
  BulkComposerStage,
} from "~/features/posts/bulk-composer/types";
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

export function RailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("border-border space-y-2 border-b px-3 py-3", className)}
    >
      <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </div>
  );
}

export function ReadonlyRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground text-right font-medium">{value}</span>
    </div>
  );
}

export function BulkSettingsRailModeBlock({
  stage,
  batchMode,
  onBatchModeChange,
}: {
  stage: BulkComposerStage;
  batchMode: BulkBatchMode;
  onBatchModeChange: (m: BulkBatchMode) => void;
}) {
  return (
    <RailSection title="Mode">
      {stage === "build" ? (
        <div className="bg-muted/50 flex gap-1 rounded-lg p-1">
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              batchMode === "schedule"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onBatchModeChange("schedule")}
          >
            Schedule
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              batchMode === "queue"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => onBatchModeChange("queue")}
          >
            Queue
          </button>
        </div>
      ) : (
        <ReadonlyRow
          label="Mode"
          value={batchMode === "schedule" ? "Schedule" : "Queue"}
        />
      )}
    </RailSection>
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
    <RailSection title="Batch defaults">
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
          <p className="text-muted-foreground text-xs">
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
        <div className="flex flex-wrap gap-1 pt-2">
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
    </RailSection>
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
    <RailSection title="Batch defaults">
      {batchMode === "schedule" ? (
        <>
          <ReadonlyRow label="Start" value={reviewScheduleStartLabel} />
          <ReadonlyRow label="Interval" value={reviewScheduleIntervalLabel} />
          <ReadonlyRow label="Randomization" value={randomizationLabel} />
        </>
      ) : (
        <>
          <ReadonlyRow label="Default queue" value={reviewQueueDefaultLabel} />
          <ReadonlyRow label="Randomization" value={randomizationLabel} />
        </>
      )}
    </RailSection>
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
      <p className="text-muted-foreground text-xs">
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
    <RailSection title="Batch options">
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
        className="mt-2 w-full text-xs"
        disabled={isProcessing}
        onClick={handleBulkRecyclableToggle}
      >
        {posts.every((post) => post.isRecyclable)
          ? "Mark all non-recyclable"
          : "Mark all recyclable"}
      </Button>
    </RailSection>
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
    <RailSection title="Batch options">
      <ReadonlyRow
        label="Hashtag presets"
        value={useHashtagPresets ? "On" : "Off"}
      />
      <ReadonlyRow
        label="Recyclable"
        value={posts.every((p) => p.isRecyclable) ? "All on" : "Mixed"}
      />
    </RailSection>
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
    <RailSection title="Summary">
      <ReadonlyRow label="Total posts" value={String(postsCount)} />
      <ReadonlyRow label="Ready" value={String(readyCount)} />
      <ReadonlyRow
        label="Needs attention"
        value={String(Math.max(0, issueCount))}
      />
      <ReadonlyRow label="Unassigned queue" value={String(unassignedCount)} />
      {reviewSummaryRows.map((row) => (
        <ReadonlyRow key={row.label} label={row.label} value={row.value} />
      ))}
    </RailSection>
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
  return (
    <RailSection title="Validation">
      {validationResult.isValid ? (
        <p className="text-muted-foreground text-sm">All checks passed.</p>
      ) : (
        <ul className="max-h-36 space-y-1 overflow-y-auto text-xs">
          {aggregateLines.cap > 0 ? (
            <li>
              <button
                type="button"
                className="text-primary text-left hover:underline"
                onClick={() => {
                  const idx = posts.findIndex((_, i) =>
                    validationResult.byPost[i]?.some((e) =>
                      e.includes("Caption")
                    )
                  );
                  if (idx >= 0) onJumpToPost(idx);
                }}
              >
                {aggregateLines.cap} missing caption
                {aggregateLines.cap !== 1 ? "s" : ""}
              </button>
            </li>
          ) : null}
          {aggregateLines.sched > 0 ? (
            <li>
              <button
                type="button"
                className="text-primary text-left hover:underline"
                onClick={() => {
                  const idx = posts.findIndex((_, i) =>
                    validationResult.byPost[i]?.some((e) =>
                      e.includes("Schedule")
                    )
                  );
                  if (idx >= 0) onJumpToPost(idx);
                }}
              >
                {aggregateLines.sched} schedule issue
                {aggregateLines.sched !== 1 ? "s" : ""}
              </button>
            </li>
          ) : null}
          {aggregateLines.lines.slice(0, 6).map((line) => (
            <li key={`${line.index}-${line.text}`}>
              <button
                type="button"
                className="text-primary text-left hover:underline"
                onClick={() => onJumpToPost(line.index)}
              >
                {line.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </RailSection>
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
    <RailSection title="Readiness">
      <p className="text-foreground text-sm font-medium">
        {validationResult.isValid
          ? `Ready to sign and schedule ${postsCount} post${postsCount !== 1 ? "s" : ""}.`
          : `${issueCount} post${issueCount !== 1 ? "s" : ""} still need attention.`}
      </p>
      {!validationResult.isValid && aggregateLines.lines[0] != null ? (
        <Button
          type="button"
          variant="link"
          className="text-primary h-auto px-0 py-1 text-xs"
          onClick={() => onJumpToPost(aggregateLines.lines[0]!.index)}
        >
          Edit first issue
        </Button>
      ) : null}
    </RailSection>
  );
}
