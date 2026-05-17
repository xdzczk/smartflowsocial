/**
 * BulkPosts Upload Area Component
 * Click or drag/drop for file uploads with progress indicator
 */

import { Loader2, Upload } from "lucide-react";
import { useCallback, useState } from "react";

import { BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE } from "~/features/upload";
import { BRAND_NAME } from "~/lib/brand";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";
import { cn } from "~/lib/utils";

interface BulkPostsUploadAreaProps {
  isProcessing: boolean;
  processingProgress: { current: number; total: number };
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilesDropped: (files: File[]) => void;
  uploadProvider: string | null;
  /** Blossom uploads blocked without NIP-07 / NIP-46 signer. */
  mediaUploadBlocked?: boolean;
  /** When posts already exist, use a lighter, smaller drop zone. */
  postCount?: number;
}

function isImageOrVideoFile(file: File): boolean {
  const t = file.type;
  return t.startsWith("image/") || t.startsWith("video/");
}

function uploadProviderCaption(uploadProvider: string): string {
  if (!uploadProvider.includes("BLOSSOM")) return "S3";
  if (uploadProvider === "BLOSSOM_PRIMAL") return "Blossom · Primal";
  if (uploadProvider === "BLOSSOM_SFS") return `Blossom · ${BRAND_NAME}`;
  return "Blossom";
}

function BulkUploadProcessingContent({
  hasPosts,
  processingProgress,
}: {
  hasPosts: boolean;
  processingProgress: { current: number; total: number };
}) {
  return (
    <>
      <div className="text-text-secondary">
        <Loader2
          className={cn("animate-spin", hasPosts ? "h-8 w-8" : "h-12 w-12")}
          aria-hidden
        />
      </div>
      <div>
        <p
          className={cn(
            "text-text-secondary dark:text-text font-medium",
            hasPosts ? "text-sm" : "text-xl"
          )}
        >
          Processing media files&hellip; {processingProgress.current}/
          {processingProgress.total}
        </p>
        <div className="bg-surface-hover mt-2 h-2 w-64 max-w-full rounded-full">
          <div
            className="bg-action-primary h-2 rounded-full transition-all duration-300"
            style={{
              width: `${(processingProgress.current / processingProgress.total) * 100}%`,
            }}
          />
        </div>
      </div>
    </>
  );
}

function BulkUploadIdleContent({
  hasPosts,
  mediaUploadBlocked,
}: {
  hasPosts: boolean;
  mediaUploadBlocked: boolean;
}) {
  return (
    <>
      <div
        className={
          mediaUploadBlocked ? "text-text-secondary opacity-50" : "text-success"
        }
      >
        <Upload
          className={hasPosts ? "h-8 w-8" : "h-12 w-12"}
          strokeWidth={INLINE_ICON_STROKE}
          aria-hidden
        />
      </div>
      <div>
        <p
          className={cn(
            "text-text-secondary dark:text-text font-medium",
            hasPosts ? "text-sm" : "text-xl"
          )}
        >
          {mediaUploadBlocked
            ? BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE
            : hasPosts
              ? "Add more images or videos to the batch"
              : "Click or drag and drop images and videos (max 100MB total)"}
        </p>
      </div>
    </>
  );
}

export default function BulkPostsUploadArea({
  isProcessing,
  processingProgress,
  onFileChange,
  onFilesDropped,
  uploadProvider,
  mediaUploadBlocked = false,
  postCount = 0,
}: BulkPostsUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const uploadDisabled = isProcessing || mediaUploadBlocked;
  const hasPosts = postCount > 0;

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!uploadDisabled) setIsDragging(true);
    },
    [uploadDisabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const related = e.relatedTarget as Node | null;
    if (related && e.currentTarget.contains(related)) return;
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!uploadDisabled) e.dataTransfer.dropEffect = "copy";
    },
    [uploadDisabled]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (uploadDisabled) return;
      const list = e.dataTransfer.files;
      const dropped = Array.from(list).filter((file) =>
        isImageOrVideoFile(file)
      );
      if (dropped.length > 0) onFilesDropped(dropped);
    },
    [uploadDisabled, onFilesDropped]
  );

  const surfaceClass = cn(
    "motion-fast relative block rounded-xl ring-1 transition-[background-color,box-shadow,color]",
    uploadDisabled &&
      "cursor-not-allowed bg-section/25 ring-border-subtle/40 opacity-95 dark:bg-section/15",
    !uploadDisabled &&
      !isDragging &&
      "cursor-pointer bg-section/50 ring-border-subtle/55 hover:bg-section/65 dark:bg-section/30 dark:ring-border-subtle/45 dark:hover:bg-section/40",
    !uploadDisabled &&
      isDragging &&
      "bg-brand/[0.07] ring-brand/35 dark:bg-brand/[0.09]"
  );

  return (
    <div
      className={cn(
        "transition-opacity",
        hasPosts ? "mb-4 opacity-95" : "mb-5"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between",
          hasPosts ? "mb-2" : "mb-3"
        )}
      >
        <h2
          className={cn(
            "font-semibold tracking-tight",
            hasPosts ? "text-text text-sm" : "text-text text-base"
          )}
        >
          Shared media
        </h2>
        {uploadProvider ? (
          <span className="text-text-secondary/80 text-[10px] tabular-nums">
            {uploadProviderCaption(uploadProvider)}
          </span>
        ) : null}
      </div>
      {/* Drag events augment the file input; keyboard users activate the control via the label + input. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drop target wraps native file input */}
      <label
        htmlFor="bulk-posts-file-input"
        className={surfaceClass}
        aria-label="Upload media files"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div
          className={cn(
            "text-center",
            hasPosts ? "px-4 py-6 sm:py-7" : "px-6 py-10 sm:px-8 sm:py-14"
          )}
        >
          <div
            className={cn(
              "flex flex-col items-center",
              hasPosts ? "gap-2" : "gap-4"
            )}
          >
            {isProcessing ? (
              <BulkUploadProcessingContent
                hasPosts={hasPosts}
                processingProgress={processingProgress}
              />
            ) : (
              <BulkUploadIdleContent
                hasPosts={hasPosts}
                mediaUploadBlocked={mediaUploadBlocked}
              />
            )}
            <input
              id="bulk-posts-file-input"
              type="file"
              name="files"
              className="hidden"
              onChange={onFileChange}
              multiple
              accept="image/*,video/*"
              disabled={uploadDisabled}
            />
          </div>
        </div>
      </label>
      {hasPosts ? (
        <p className="text-text-secondary mt-2 text-[11px] leading-snug">
          Per-post queue, schedule, follow-up, and tags: use{" "}
          <span className="text-text font-medium">Advanced</span> on each card.
        </p>
      ) : null}
    </div>
  );
}
