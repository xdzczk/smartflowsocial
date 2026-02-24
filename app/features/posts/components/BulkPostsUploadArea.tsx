/**
 * BulkPosts Upload Area Component
 * Drag/drop area for file uploads with progress indicator
 */

import { Loader2, Upload } from "lucide-react";

import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

interface BulkPostsUploadAreaProps {
  isProcessing: boolean;
  processingProgress: { current: number; total: number };
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadProvider: string | null;
}

export default function BulkPostsUploadArea({
  isProcessing,
  processingProgress,
  onFileChange,
  uploadProvider,
}: BulkPostsUploadAreaProps) {
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
      <label
        htmlFor="bulk-posts-file-input"
        className={`block ${isProcessing ? "cursor-not-allowed" : "cursor-pointer"}`}
        aria-label="Upload media files"
      >
        <div
          className={`rounded-lg border-2 border-dashed p-12 text-center ${
            isProcessing
              ? "dark:bg-card border-border bg-muted dark:border-border"
              : "border-border"
          }`}
        >
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
                <div className="text-success">
                  <Upload
                    className="h-12 w-12"
                    strokeWidth={INLINE_ICON_STROKE}
                    aria-hidden
                  />
                </div>
                <div>
                  <p className="text-muted-foreground dark:text-foreground text-xl font-medium">
                    Click to upload images and videos (Max 100MB)
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
              disabled={isProcessing}
            />
          </div>
        </div>
      </label>
    </div>
  );
}
