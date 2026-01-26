import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";

import { getDynamicQueueStyle } from "../queue-colors";

import type { BulkPost, QueueType } from "./BulkPostCard";

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
}: BulkPostsActionButtonsProps) {
  if (posts.length === 0) return null;

  return (
    <>
      <div className="mt-4 mb-4 flex flex-col items-center gap-3">
        <div className="flex justify-center">
          {scheduleIntervals
            ? scheduleIntervals.map((interval) => (
                <button
                  key={interval}
                  type="button"
                  onClick={() => handleScheduleIntervalClick(interval)}
                  disabled={isProcessing}
                  className="dark:bg-card bg-muted text-muted-foreground hover:bg-muted dark:text-foreground dark:hover:bg-muted mx-2 rounded-md px-4 py-2 text-sm font-medium shadow-md transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                >
                  +{interval}h
                </button>
              ))
            : null}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap justify-center gap-2">
          {queueTypes.map((queue) => {
            const queueName = typeof queue === "string" ? queue : queue.name;
            const queueColor = typeof queue === "object" ? queue.color : null;
            // Check if this queue is selected for all posts
            const isAllSelected =
              posts.length > 0 && posts.every((p) => p.queueType === queueName);
            return (
              <button
                key={queueName}
                type="button"
                onClick={() => {
                  handleBulkQueueUpdate(queueName);
                }}
                disabled={isProcessing}
                className={`rounded-full px-4 py-2 text-sm ${getDynamicQueueStyle(queueColor ?? null, isAllSelected)} disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100`}
                style={{
                  backgroundColor: queueColor ?? undefined,
                  borderColor: queueColor ?? undefined,
                }}
              >
                {queueName}
              </button>
            );
          })}
        </div>
        <p className="text-muted-foreground dark:text-foreground mt-2 text-center text-xs">
          Click a queue to update all posts
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
            className="bg-muted text-foreground hover:bg-muted/80 rounded-md px-4 py-2 text-sm font-medium shadow-md transition-all hover:scale-105 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
          >
            {posts.every((post) => post.isRecyclable)
              ? "Mark All Non-Recyclable"
              : "Mark All Recyclable"}
          </button>
        </div>
        <p className="text-muted-foreground dark:text-foreground mt-2 text-center text-xs">
          Toggle recyclable status for all posts
        </p>
      </div>
    </>
  );
}
