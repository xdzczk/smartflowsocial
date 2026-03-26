/**
 * Section components for UnifiedComposer: content+media vs thread block.
 * Keeps UnifiedComposer.tsx focused on hook wiring and layout.
 */

import type { ComposerAttachment } from "~/features/posts/types";

import {
  ComposerContentField,
  ComposerMediaField,
  ComposerThreadField,
} from ".";

export interface UnifiedComposerContentSectionProps {
  isThreadMode: boolean;
  content: string;
  onContentChange: (v: string) => void;
  contentError: string | undefined;
  disabled: boolean;
  showDraftButton: boolean;
  onOpenDraft: () => void;
  attachments: ComposerAttachment[];
  onRemoveAttachment: (localId: string) => void;
  onAddAttachment: () => void;
  onFilesDroppedSingle: (files: File[]) => void;
  threadSegments: Array<{
    id: string;
    content: string;
    attachments: ComposerAttachment[];
  }>;
  onThreadSegmentsChange: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string;
        content: string;
        attachments: ComposerAttachment[];
      }>
    >
  >;
  threadDelayMinutes: number;
  onFilesDroppedSegment: (segmentId: string, files: File[]) => void;
  onThreadSegmentFileClick: (segmentId: string) => void;
  draggingOverSegmentId: string | null;
  onDraggingOverSegmentIdChange: React.Dispatch<
    React.SetStateAction<string | null>
  >;
}

export function UnifiedComposerContentSection({
  isThreadMode,
  content,
  onContentChange,
  contentError,
  disabled,
  showDraftButton,
  onOpenDraft,
  attachments,
  onRemoveAttachment,
  onAddAttachment,
  onFilesDroppedSingle,
  threadSegments,
  onThreadSegmentsChange,
  threadDelayMinutes,
  onFilesDroppedSegment,
  onThreadSegmentFileClick,
  draggingOverSegmentId,
  onDraggingOverSegmentIdChange,
}: UnifiedComposerContentSectionProps) {
  if (isThreadMode) {
    return (
      <ComposerThreadField
        segments={threadSegments}
        onSegmentsChange={onThreadSegmentsChange}
        threadDelayMinutes={threadDelayMinutes}
        onFilesDropped={onFilesDroppedSegment}
        onAddSegmentClick={(segmentId) => onThreadSegmentFileClick(segmentId)}
        disabled={disabled}
        draggingOverSegmentId={draggingOverSegmentId}
        onDraggingOverSegmentIdChange={onDraggingOverSegmentIdChange}
      />
    );
  }
  return (
    <>
      <ComposerContentField
        value={content}
        onChange={onContentChange}
        error={contentError != null ? { message: contentError } : undefined}
        disabled={disabled}
        showDraftButton={showDraftButton}
        onOpenDraft={onOpenDraft}
      />
      <ComposerMediaField
        attachments={attachments}
        onRemove={onRemoveAttachment}
        onAdd={onAddAttachment}
        onFilesDropped={onFilesDroppedSingle}
        disabled={disabled}
      />
    </>
  );
}
