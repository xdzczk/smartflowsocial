/**
 * BulkPosts Upload Area Component
 * Drag/drop area for file uploads with progress indicator
 */

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
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>Upload via:</span>
            <span
              className={`rounded px-2 py-1 text-xs font-medium ${
                uploadProvider.includes("BLOSSOM")
                  ? "bg-purple-100 text-purple-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {uploadProvider.includes("BLOSSOM")
                ? `🌸 ${uploadProvider === "BLOSSOM_PRIMAL" ? "Primal" : "Blosstr"}`
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
              ? "border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-gray-800"
              : "border-gray-300"
          }`}
        >
          <div className="flex flex-col items-center gap-4">
            {isProcessing ? (
              <>
                <div className="text-blue-500">
                  <svg className="h-12 w-12 animate-spin" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-medium text-gray-700 dark:text-gray-300">
                    Processing media files&hellip; {processingProgress.current}/
                    {processingProgress.total}
                  </p>
                  <div className="mt-2 h-2 w-64 rounded-full bg-gray-200">
                    <div
                      className="h-2 rounded-full bg-blue-500 transition-all duration-300"
                      style={{
                        width: `${(processingProgress.current / processingProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="text-green-500">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xl font-medium text-gray-700 dark:text-gray-300">
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
