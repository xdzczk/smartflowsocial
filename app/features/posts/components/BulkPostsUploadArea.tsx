/**
 * BulkPosts Upload Area Component
 * Click or drag/drop for file uploads with progress indicator
 */

import { Loader2, Upload } from "lucide-react";
import { useCallback, useState } from "react";

import { BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE } from "~/features/upload";
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
  if (uploadProvider === "BLOSSOM_SFS") return "Blossom · SmartFlow";
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
      <div className="text-muted-foreground">
        <Loader2
          className={cn("animate-spin", hasPosts ? "h-8 w-8" : "h-12 w-12")}
          aria-hidden
        />
      </div>
      <div>
        <p
          className={cn(
            "text-muted-foreground dark:text-foreground font-medium",
            hasPosts ? "text-sm" : "text-xl"
          )}
        >
          Processing media files&hellip; {processingProgress.current}/
          {processingProgress.total}
        </p>
        <div className="bg-muted mt-2 h-2 w-64 rounded-full">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
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
          mediaUploadBlocked
            ? "text-muted-foreground opacity-50"
            : "text-success"
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
            "text-muted-foreground dark:text-foreground font-medium",
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

  const labelBorderClass = uploadDisabled
    ? "dark:bg-card border-border bg-muted dark:border-border"
    : isDragging
      ? "border-primary bg-primary/5"
      : "border-border";

  return (
    <div
      className={cn(
        "transition-opacity",
        hasPosts ? "mb-4 opacity-90" : "mb-6"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between",
          hasPosts ? "mb-2" : "mb-4"
        )}
      >
        <h2
          className={cn(
            "font-semibold",
            hasPosts ? "text-foreground text-sm" : "text-lg"
          )}
        >
          Shared media
        </h2>
        {uploadProvider ? (
          <span className="text-muted-foreground/80 text-[10px] tabular-nums">
            {uploadProviderCaption(uploadProvider)}
          </span>
        ) : null}
      </div>
      {/* Drag events augment the file input; keyboard users activate the control via the label + input. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drop target wraps native file input */}
      <label
        htmlFor="bulk-posts-file-input"
        className={`relative block rounded-lg border-2 border-dashed transition-colors ${labelBorderClass} ${uploadDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        aria-label="Upload media files"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className={cn("text-center", hasPosts ? "p-6" : "p-12")}>
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
        <p className="text-muted-foreground mt-2 text-[11px] leading-snug">
          Per-post queue, schedule, follow-up, and tags: use{" "}
          <span className="text-foreground font-medium">Advanced</span> on each
          card.
        </p>
      ) : null}
    </div>
  );
}
