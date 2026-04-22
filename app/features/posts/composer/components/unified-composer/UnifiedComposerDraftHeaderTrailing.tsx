import { Button } from "~/components/ui/button";

export interface UnifiedComposerDraftHeaderTrailingProps {
  disabled: boolean;
  draftTemplatesPickerEnabled: boolean;
  onOpenDrafts: () => void;
  onOpenTemplates: () => void;
}

export function UnifiedComposerDraftHeaderTrailing({
  disabled,
  draftTemplatesPickerEnabled,
  onOpenDrafts,
  onOpenTemplates,
}: UnifiedComposerDraftHeaderTrailingProps) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onOpenDrafts}
        disabled={disabled}
        aria-label="Open drafts"
        className="text-text-secondary hover:text-text h-8 px-2 text-xs"
      >
        Drafts
      </Button>
      {draftTemplatesPickerEnabled ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onOpenTemplates}
          disabled={disabled}
          aria-label="Open templates"
          className="text-text-secondary hover:text-text h-8 px-2 text-xs"
        >
          Templates
        </Button>
      ) : null}
    </div>
  );
}
