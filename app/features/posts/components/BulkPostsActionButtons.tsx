import { useState } from "react";

import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { formatIntervalLabel } from "~/lib/schedule-intervals";

import { getDynamicQueueStyle, getQueueAccentHex } from "../queue-colors";

import type { BulkPost, QueueType } from "./BulkPostCard";

export interface RepostAllDelay {
  value: number;
  unit: "hours" | "minutes";
}

interface BulkPostsActionButtonsProps {
  posts: BulkPost[];
  isProcessing: boolean;
  scheduleIntervals: number[] | undefined;
  queueTypes: QueueType[];
  hashTagPresets: Array<{ id: string; name: string; tags: string }>;
  selectedHashtagPresetId: string | null;
  useHashtagPresets: boolean;
  handleScheduleIntervalClick: (interval: number) => void;
  handleBulkQueueUpdate: (queueName: string) => void;
  handleHashtagPresetSelect: (
    presetId: string | null,
    hashtags: string
  ) => void;
  setUseHashtagPresets: (use: boolean) => void;
  handleBulkRecyclableToggle: () => void;
  onRepostAll?: (delay: RepostAllDelay) => void;
}

export default function BulkPostsActionButtons({
  posts,
  isProcessing,
  scheduleIntervals,
  queueTypes,
  hashTagPresets,
  selectedHashtagPresetId,
  useHashtagPresets,
  handleScheduleIntervalClick,
  handleBulkQueueUpdate,
  handleHashtagPresetSelect,
  setUseHashtagPresets,
  handleBulkRecyclableToggle,
  onRepostAll,
}: BulkPostsActionButtonsProps) {
  const [repostAllOpen, setRepostAllOpen] = useState(false);
  const [repostAllValue, setRepostAllValue] = useState(12);
  const [repostAllUnit, setRepostAllUnit] = useState<"hours" | "minutes">(
    "hours"
  );

  if (posts.length === 0) return null;

  const handleRepostAllApply = () => {
    const value = Math.max(1, Math.floor(repostAllValue) || 1);
    onRepostAll?.({ value, unit: repostAllUnit });
    setRepostAllOpen(false);
  };

  const repostAllLabel =
    repostAllUnit === "hours"
      ? `${repostAllValue}h after`
      : `${repostAllValue}min after`;

  return (
    <>
      {onRepostAll ? (
        <div className="mb-4 flex justify-center">
          <Popover open={repostAllOpen} onOpenChange={setRepostAllOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                disabled={isProcessing}
                className="bg-surface-hover text-text hover:bg-surface-hover/80"
              >
                Repost all {repostAllLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64" align="center">
              <div className="space-y-3">
                <p className="text-text-secondary text-sm font-medium">
                  Set repost delay for all posts
                </p>
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
                    aria-label="Delay value"
                  />
                  <select
                    value={repostAllUnit}
                    onChange={(e) =>
                      setRepostAllUnit(e.target.value as "hours" | "minutes")
                    }
                    className="border-border bg-canvas text-text h-9 w-24 rounded-xs border px-2 text-sm"
                    aria-label="Unit"
                  >
                    <option value="hours">hours</option>
                    <option value="minutes">minutes</option>
                  </select>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full"
                  onClick={handleRepostAllApply}
                >
                  Apply to all posts
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      ) : null}
      <div className="mt-4 mb-4 flex flex-col items-center gap-3">
        <div className="flex justify-center">
          {scheduleIntervals
            ? scheduleIntervals.map((interval) => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => handleScheduleIntervalClick(interval)}
                  disabled={isProcessing}
                  className="dark:bg-surface bg-surface-hover text-text-secondary hover:bg-surface-hover dark:text-text dark:hover:bg-surface-hover shadow-2 mx-2 rounded-md px-4 py-2 text-sm font-medium transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  {formatIntervalLabel(interval, { compact: true })}
                </button>
              ))
            : null}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap justify-center gap-2">
          {queueTypes
            .filter((queue) => {
              const name = typeof queue === "string" ? queue : queue.name;
              return name !== "Unassigned";
            })
            .map((queue) => {
              const queueName = typeof queue === "string" ? queue : queue.name;
              const colorToken =
                typeof queue === "object"
                  ? (queue as { colorToken?: string | null }).colorToken
                  : null;
              const isAllSelected =
                posts.length > 0 &&
                posts.every((p) => p.queueType === queueName);
              const accent =
                colorToken != null ? getQueueAccentHex(colorToken) : undefined;
              return (
                <button
                  key={queueName}
                  type="button"
                  onClick={() =>
                    handleBulkQueueUpdate(
                      isAllSelected ? "unassigned" : queueName
                    )
                  }
                  disabled={isProcessing}
                  className={`rounded-md border-2 px-4 py-2 text-sm ${getDynamicQueueStyle(colorToken ?? null, isAllSelected)} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100`}
                  style={{
                    backgroundColor: accent,
                    borderColor: accent,
                  }}
                  title={
                    isAllSelected
                      ? "Click again to leave all posts unassigned"
                      : "Assign this queue to all posts"
                  }
                >
                  {queueName}
                </button>
              );
            })}
        </div>
        <p className="text-text-secondary dark:text-text mt-2 text-center text-xs">
          Click a queue to assign; click again to leave all unassigned
        </p>
      </div>

      <div className="mx-auto mb-6 max-w-md">
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
      </div>

      <div className="mb-6">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={handleBulkRecyclableToggle}
            disabled={isProcessing}
            className="bg-surface-hover text-text hover:bg-surface-hover/80 shadow-2 rounded-md px-4 py-2 text-sm font-medium transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {posts.every((post) => post.isRecyclable)
              ? "Mark All Non-Recyclable"
              : "Mark All Recyclable"}
          </button>
        </div>
        <p className="text-text-secondary dark:text-text mt-2 text-center text-xs">
          Toggle recyclable status for all posts
        </p>
      </div>
    </>
  );
}
