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
    <div className="border-primary/30 bg-primary/10 mb-4 flex items-center justify-between rounded-lg border p-4">
      <span className="text-primary text-sm font-medium">
        {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <button
        onClick={onBulkDelete}
        disabled={isDeleting}
        className="border-destructive/30 bg-card text-destructive hover:border-destructive/50 hover:bg-destructive/10 focus:ring-destructive/25 active:border-destructive/30 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
      >
        {isDeleting
          ? "Deleting..."
          : `Delete ${selectedCount} post${selectedCount !== 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
