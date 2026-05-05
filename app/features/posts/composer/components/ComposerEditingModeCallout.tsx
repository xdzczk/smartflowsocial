export interface ComposerEditingMeta {
  modeLabel: string;
  accountLabel: string;
  scheduledForLabel?: string;
  statusLabel?: string;
  queueLabel?: string;
  parentActionId?: string;
}

interface ComposerEditingModeCalloutProps {
  editingMeta: ComposerEditingMeta;
  /** Defaults to short-form copy; use article wording when editing long-form. */
  detailLine?: string;
}

export function ComposerEditingModeCallout({
  editingMeta,
  detailLine = "Changes update the existing item. A new post will not be created.",
}: ComposerEditingModeCalloutProps) {
  return (
    <div className="bg-surface-hover/60 border-border mb-4 rounded-md border px-3 py-2 text-sm">
      <p className="font-medium">{editingMeta.modeLabel}</p>
      <p className="text-text-secondary mt-1 text-xs">{detailLine}</p>
      <p className="text-text-secondary mt-1">
        Account: {editingMeta.accountLabel}
        {editingMeta.scheduledForLabel
          ? ` · Scheduled for: ${editingMeta.scheduledForLabel}`
          : ""}
        {editingMeta.queueLabel ? ` · Queue: ${editingMeta.queueLabel}` : ""}
        {editingMeta.statusLabel ? ` · Status: ${editingMeta.statusLabel}` : ""}
      </p>
      {editingMeta.parentActionId ? (
        <p className="text-text-secondary mt-1">
          Parent action: {editingMeta.parentActionId}
        </p>
      ) : null}
    </div>
  );
}
