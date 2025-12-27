import { HashtagPresetToggle } from "~/components/dashboard/HashtagPresetToggle";
import type { BulkPost, QueueType } from "~/features/posts/components/BulkPostCard";
import { getDynamicQueueStyle } from "~/features/posts/queueColors";

interface BulkPostsActionButtonsProps {
    posts: BulkPost[];
    isProcessing: boolean;
    scheduleIntervals: number[] | undefined;
    queueTypes: QueueType[];
    hashTagPresets: { id: string; name: string; hashtags: string }[];
    selectedHashtagPresetId: string | null;
    useHashtagPresets: boolean;
    handleScheduleIntervalClick: (interval: number) => void;
    handleBulkQueueUpdate: (queueName: string) => void;
    handleHashtagPresetSelect: (presetId: string | null, hashtags: string) => void;
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
            <div className="mb-4 mt-4 flex flex-col items-center gap-3">
                <div className="flex justify-center">
                    {scheduleIntervals
                        ? scheduleIntervals.map((interval) => (
                            <button
                                key={interval}
                                type="button"
                                onClick={() => handleScheduleIntervalClick(interval)}
                                disabled={isProcessing}
                                className="mx-2 rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 shadow-md transition-all hover:scale-105 hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
                        const queueName =
                            typeof queue === "string" ? queue : (queue.name || "");
                        const queueColor =
                            typeof queue === "object" ? queue.color : null;
                        // Check if this queue is selected for all posts
                        const isAllSelected =
                            posts.length > 0 &&
                            posts.every((p) => p.queueType === queueName);
                        return (
                            <button
                                key={queueName}
                                type="button"
                                onClick={() => {
                                    handleBulkQueueUpdate(queueName ?? "");
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
                <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                    Click a queue to update all posts
                </p>
            </div>

            <div className="mx-auto mb-6 max-w-md">
                <HashtagPresetToggle
                    presets={hashTagPresets.map(p => ({ id: p.id, name: p.name, tags: p.hashtags }))}
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
                        className="rounded-md bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 shadow-md transition-all hover:scale-105 hover:bg-purple-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 dark:bg-purple-800 dark:text-purple-300 dark:hover:bg-purple-700"
                    >
                        {posts.every((post) => post.isRecyclable)
                            ? "Mark All Non-Recyclable"
                            : "Mark All Recyclable"}
                    </button>
                </div>
                <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
                    Toggle recyclable status for all posts
                </p>
            </div>
        </>
    );
}
