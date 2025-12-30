/**
 * Bulk delete action bar component
 */

interface BulkDeleteBarProps {
  selectedCount: number;
  onBulkDelete: () => void;
  isDeleting: boolean;
}

export function BulkDeleteBar({
  selectedCount,
  onBulkDelete,
  isDeleting,
}: BulkDeleteBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900/50">
      <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
        {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <button
        onClick={onBulkDelete}
        disabled={isDeleting}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
      >
        {isDeleting
          ? "Deleting..."
          : `Delete ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}












