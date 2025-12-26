import { useFetcher } from "@remix-run/react";

interface RecyclablesBulkActionsProps {
  selectedCount: number;
  onBulkRepost: () => void;
  onBulkScheduledRepost: () => void;
  onBulkQuote: () => void;
  onBulkDelete: () => void;
  repostFetcher: ReturnType<typeof useFetcher>;
  bulkDeleteFetcher: ReturnType<typeof useFetcher>;
}

/**
 * Bulk actions bar for recyclables posts
 */
export function RecyclablesBulkActions({
  selectedCount,
  onBulkRepost,
  onBulkScheduledRepost,
  onBulkQuote,
  onBulkDelete,
  repostFetcher,
  bulkDeleteFetcher,
}: RecyclablesBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
        {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        <button
          onClick={onBulkRepost}
          disabled={repostFetcher.state !== "idle"}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-blue-800 hover:border-blue-300 hover:text-blue-900 hover:shadow-sm focus:ring focus:ring-blue-300/25 active:border-blue-200 active:shadow-none disabled:opacity-50 dark:border-blue-700 dark:bg-gray-800 dark:text-blue-300 dark:hover:border-blue-600 dark:hover:text-blue-200 dark:focus:ring-blue-600/40 dark:active:border-blue-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {repostFetcher.state !== "idle"
            ? "Processing..."
            : `Recycle ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkScheduledRepost}
          disabled={repostFetcher.state !== "idle"}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-purple-800 hover:border-purple-300 hover:text-purple-900 hover:shadow-sm focus:ring focus:ring-purple-300/25 active:border-purple-200 active:shadow-none disabled:opacity-50 dark:border-purple-700 dark:bg-gray-800 dark:text-purple-300 dark:hover:border-purple-600 dark:hover:text-purple-200 dark:focus:ring-purple-600/40 dark:active:border-purple-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
            />
          </svg>
          {repostFetcher.state !== "idle"
            ? "Processing..."
            : `Repost ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkQuote}
          disabled={repostFetcher.state !== "idle"}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-green-800 hover:border-green-300 hover:text-green-900 hover:shadow-sm focus:ring focus:ring-green-300/25 active:border-green-200 active:shadow-none disabled:opacity-50 dark:border-green-700 dark:bg-gray-800 dark:text-green-300 dark:hover:border-green-600 dark:hover:text-green-200 dark:focus:ring-green-600/40 dark:active:border-green-700"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          {repostFetcher.state !== "idle"
            ? "Processing..."
            : `Quote ${selectedCount} Post${selectedCount !== 1 ? "s" : ""}`}
        </button>
        <button
          onClick={onBulkDelete}
          disabled={bulkDeleteFetcher.state !== "idle"}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
        >
          {bulkDeleteFetcher.state !== "idle"
            ? "Deleting..."
            : `Delete ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}


