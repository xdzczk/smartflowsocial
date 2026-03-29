/**
 * Section components for UnifiedComposer: content+media vs thread block.
 * Keeps UnifiedComposer.tsx focused on hook wiring and layout.
 */

import type { Dispatch, ReactNode, SetStateAction } from "react";

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
  /** When true, media pick/drop/paste is blocked (e.g. Blossom without signer). Text stays editable. */
  mediaUploadDisabled?: boolean;
  attachments: ComposerAttachment[];
  onRemoveAttachment: (localId: string) => void;
  onAddAttachment: () => void;
  onReorderAttachments?: (fromIndex: number, toIndex: number) => void;
  onFilesDroppedSingle: (files: File[]) => void;
  threadSegments: Array<{
    id: string;
    content: string;
    attachments: ComposerAttachment[];
  }>;
  onThreadSegmentsChange: Dispatch<
    SetStateAction<
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
  onDraggingOverSegmentIdChange: Dispatch<SetStateAction<string | null>>;
  blossomSignerMediaNote?: ReactNode;
  attachmentFailedTitleHint?: string;
}

export function UnifiedComposerContentSection({
  isThreadMode,
  content,
  onContentChange,
  contentError,
  disabled,
  mediaUploadDisabled = false,
  attachments,
  onRemoveAttachment,
  onAddAttachment,
  onReorderAttachments,
  onFilesDroppedSingle,
  threadSegments,
  onThreadSegmentsChange,
  threadDelayMinutes,
  onFilesDroppedSegment,
  onThreadSegmentFileClick,
  draggingOverSegmentId,
  onDraggingOverSegmentIdChange,
  blossomSignerMediaNote,
  attachmentFailedTitleHint,
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
        attachmentsDisabled={disabled || mediaUploadDisabled}
        draggingOverSegmentId={draggingOverSegmentId}
        onDraggingOverSegmentIdChange={onDraggingOverSegmentIdChange}
        signerConnectionNote={blossomSignerMediaNote}
        attachmentFailedTitle={attachmentFailedTitleHint}
      />
    );
  }
  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <ComposerContentField
        value={content}
        onChange={onContentChange}
        error={contentError != null ? { message: contentError } : undefined}
        disabled={disabled}
        surface="embedded"
      />
      <ComposerMediaField
        attachments={attachments}
        onRemove={onRemoveAttachment}
        onAdd={onAddAttachment}
        onReorder={onReorderAttachments}
        onFilesDropped={onFilesDroppedSingle}
        disabled={disabled || mediaUploadDisabled}
        signerConnectionNote={blossomSignerMediaNote}
        attachmentFailedTitle={attachmentFailedTitleHint}
      />
    </div>
  );
}
