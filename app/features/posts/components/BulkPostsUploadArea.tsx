/**
 * BulkPosts Upload Area Component
 * Click or drag/drop for file uploads with progress indicator
 */

import { Loader2, Upload } from "lucide-react";
import { useCallback, useState } from "react";

import { BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE } from "~/features/upload";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

interface BulkPostsUploadAreaProps {
  isProcessing: boolean;
  processingProgress: { current: number; total: number };
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFilesDropped: (files: File[]) => void;
  uploadProvider: string | null;
  /** Blossom uploads blocked without NIP-07 / NIP-46 signer. */
  mediaUploadBlocked?: boolean;
}

function isImageOrVideoFile(file: File): boolean {
  const t = file.type;
  return t.startsWith("image/") || t.startsWith("video/");
}

export default function BulkPostsUploadArea({
  isProcessing,
  processingProgress,
  onFileChange,
  onFilesDropped,
  uploadProvider,
  mediaUploadBlocked = false,
}: BulkPostsUploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const uploadDisabled = isProcessing || mediaUploadBlocked;

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

  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Upload Media Files</h2>
        {uploadProvider ? (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <span>Upload via:</span>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                uploadProvider.includes("BLOSSOM")
                  ? "bg-muted text-foreground"
                  : "bg-muted text-foreground"
              }`}
            >
              {uploadProvider.includes("BLOSSOM")
                ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : uploadProvider === "BLOSSOM_SFS" ? "SmartFlow Blossom" : "Blosstr"}`
                : "☁️ S3"}
            </span>
          </div>
        ) : null}
      </div>
      {/* Drag events augment the file input; keyboard users activate the control via the label + input. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- drop target wraps native file input */}
      <label
        htmlFor="bulk-posts-file-input"
        className={`relative block rounded-lg border-2 border-dashed transition-colors ${
          uploadDisabled
            ? "dark:bg-card border-border bg-muted dark:border-border"
            : isDragging
              ? "border-primary bg-primary/5"
              : "border-border"
        } ${uploadDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
        aria-label="Upload media files"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            {isProcessing ? (
              <>
                <div className="text-muted-foreground">
                  <Loader2 className="h-12 w-12 animate-spin" aria-hidden />
                </div>
                <div>
                  <p className="text-muted-foreground dark:text-foreground text-xl font-medium">
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
            ) : (
              <>
                <div
                  className={
                    mediaUploadBlocked
                      ? "text-muted-foreground opacity-50"
                      : "text-success"
                  }
                >
                  <Upload
                    className="h-12 w-12"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                </div>
                <div>
                  <p className="text-muted-foreground dark:text-foreground text-xl font-medium">
                    {mediaUploadBlocked
                      ? BLOSSOM_MEDIA_REQUIRES_SIGNER_MESSAGE
                      : "Click or drag and drop images and videos (max 100MB total)"}
                  </p>
                </div>
              </>
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
    </div>
  );
}
