import type { PostFetcher } from "~/features/posts/types";
interface ContentBulkActionsProps {
  type: "scheduled" | "draft" | "posted";
  selectedCount: number;
  onBulkDelete: () => void;
  onBulkRepost?: () => void;
  onBulkScheduledRepost?: () => void;
  onBulkQuote?: () => void;
  bulkDeleteState: string;
  repostFetcher?: PostFetcher;
}

export function ContentBulkActions({
  type,
  selectedCount,
  onBulkDelete,
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  bulkDeleteState,
  repostFetcher,
}: ContentBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
        {selectedCount} item{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        {type === "posted" ? (
          <>
            <button
              onClick={onBulkRepost}
              disabled={repostFetcher ? repostFetcher.state !== "idle" : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
            >
              {repostFetcher && repostFetcher.state !== "idle"
                ? "Processing..."
                : `Recycle ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={onBulkScheduledRepost}
              disabled={repostFetcher ? repostFetcher.state !== "idle" : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
            >
              {repostFetcher && repostFetcher.state !== "idle"
                ? "Processing..."
                : `Repost ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
            </button>
            <button
              onClick={onBulkQuote}
              disabled={repostFetcher ? repostFetcher.state !== "idle" : undefined}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
            >
              {repostFetcher && repostFetcher.state !== "idle"
                ? "Processing..."
                : `Quote ${selectedCount} Item${selectedCount !== 1 ? "s" : ""}`}
            </button>
          </>
        ) : null}
        <button
          onClick={onBulkDelete}
          disabled={bulkDeleteState !== "idle"}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
        >
          {bulkDeleteState !== "idle"
            ? "Deleting..."
            : `Delete ${selectedCount} item${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

