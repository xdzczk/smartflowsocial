/**
 * Bulk actions bar for drafts
 */

interface DraftsBulkActionsProps {
  selectedCount: number;
  onBulkEdit: () => void;
  onBulkDelete: () => void;
  isDeleting: boolean;
  isResuming: boolean;
}

export function DraftsBulkActions({
  selectedCount,
  onBulkEdit,
  onBulkDelete,
  isDeleting,
  isResuming,
}: DraftsBulkActionsProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="dark:border-border dark:bg-muted mb-4 flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 p-4">
      <span className="dark:text-foreground text-sm font-medium text-gray-900">
        {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex gap-2">
        <button
          onClick={onBulkEdit}
          disabled={isResuming}
          className="border-primary/30 bg-card text-primary hover:border-primary/50 hover:bg-primary/10 focus:ring-primary/25 active:border-primary/30 inline-flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm leading-5 font-semibold focus:ring active:shadow-none disabled:opacity-50"
        >
          Bulk Edit
        </button>
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
    </div>
  );
}
