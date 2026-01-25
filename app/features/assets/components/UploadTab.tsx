import MediaThumbnail from "~/components/ui/MediaThumbnail";
interface UploadTabProps {
  textAssetFormRef: React.RefObject<HTMLFormElement>;
  imageAssetFormRef: React.RefObject<HTMLFormElement>;
  assetFetcher: {
    Form: React.ComponentType<{
      children: React.ReactNode;
      method: string;
      className?: string;
      ref?: React.Ref<HTMLFormElement>;
    }>;
    state: "idle" | "submitting" | "loading";
  };
  uploadProvider: string | null;
  bulkUploadFiles: File[];
  singleFileUploading: boolean;
  bulkFileUploading: boolean;
  onSingleFileUpload: (e: React.FormEvent, form: HTMLFormElement) => void;
  onBulkFileUpload: () => void;
  onBulkFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadTab({
  textAssetFormRef,
  imageAssetFormRef,
  assetFetcher,
  uploadProvider,
  bulkUploadFiles,
  singleFileUploading,
  bulkFileUploading,
  onSingleFileUpload,
  onBulkFileUpload,
  onBulkFileChange,
}: UploadTabProps) {
  const AssetFetcherForm = assetFetcher.Form;

  return (
    <div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Text Asset Upload */}
        <div className="dark:bg-card rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700">
          <h3 className="mb-4 text-lg font-semibold">Add Text Asset</h3>
          <AssetFetcherForm
            ref={textAssetFormRef}
            method="post"
            className="space-y-4"
          >
            <input type="hidden" name="_action" value="create_text_asset" />
            <div>
              <label
                htmlFor="text-asset-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Title (optional)
              </label>
              <input
                id="text-asset-title"
                type="text"
                name="title"
                placeholder="Asset title"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="text-asset-content"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Content
              </label>
              <textarea
                id="text-asset-content"
                name="content"
                placeholder="Enter your text content..."
                rows={4}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                required
              />
            </div>
            <div>
              <label
                htmlFor="text-asset-tags"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Tags (comma-separated)
              </label>
              <input
                id="text-asset-tags"
                type="text"
                name="tags"
                placeholder="tag1, tag2, tag3"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              disabled={assetFetcher.state !== "idle"}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {assetFetcher.state !== "idle" ? "Adding..." : "Add Text Asset"}
            </button>
          </AssetFetcherForm>
        </div>

        {/* Single Media Upload */}
        <div className="dark:bg-card rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700">
          <h3 className="mb-4 text-lg font-semibold">Add Single Media</h3>
          <form
            ref={imageAssetFormRef}
            onSubmit={(e) => {
              const form = e.currentTarget;
              onSingleFileUpload(e, form);
            }}
            className="space-y-4"
          >
            <input type="hidden" name="_action" value="create_media_asset" />
            <div>
              <label
                htmlFor="media-asset-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Title (optional)
              </label>
              <input
                id="media-asset-title"
                type="text"
                name="title"
                placeholder="Asset title"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <div>
              <label
                htmlFor="media-asset-file"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Media File (Image or Video)
              </label>
              <input
                id="media-asset-file"
                type="file"
                name="file"
                accept="image/*,video/*"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                required
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Supports images (up to 10MB) and videos (up to 100MB)
              </p>
              {uploadProvider ? (
                <p className="mt-1 text-xs text-blue-600 dark:text-blue-400">
                  Using{" "}
                  {uploadProvider === "nostr"
                    ? "NOSTR"
                    : uploadProvider.toUpperCase()}{" "}
                  upload provider
                </p>
              ) : null}
            </div>
            <div>
              <label
                htmlFor="media-asset-tags"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Tags (comma-separated)
              </label>
              <input
                id="media-asset-tags"
                type="text"
                name="tags"
                placeholder="tag1, tag2, tag3"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
            <button
              type="submit"
              disabled={singleFileUploading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {singleFileUploading ? "Uploading..." : "Add Media Asset"}
            </button>
          </form>
        </div>
      </div>

      {/* Bulk Media Upload */}
      <div className="dark:bg-card mt-8 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700">
        <h3 className="mb-4 text-lg font-semibold">Bulk Media Upload</h3>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="bulk-media-files"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Select Multiple Media Files
            </label>
            <input
              id="bulk-media-files"
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={onBulkFileChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {bulkUploadFiles.length > 0 ? (
            <form data-bulk-form method="post" className="space-y-4">
              <input
                type="hidden"
                name="_action"
                value="bulk_create_media_assets"
              />
              <div className="max-h-96 space-y-4 overflow-y-auto">
                {bulkUploadFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="rounded-lg border border-gray-300 p-4"
                  >
                    <div className="flex items-start gap-4">
                      <MediaThumbnail
                        src={URL.createObjectURL(file)}
                        alt={`Preview ${index + 1}`}
                        forceType={
                          file.type.startsWith("video/") ? "video" : "image"
                        }
                        className="h-16 w-16 rounded object-cover"
                      />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {file.name}
                        </p>
                        <input
                          id={`bulk-title-${index}`}
                          type="text"
                          name="titles"
                          placeholder={`Title for ${file.name}`}
                          defaultValue={file.name.replace(/\.[^/.]+$/, "")}
                          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                        />
                        <input
                          id={`bulk-tags-${index}`}
                          type="text"
                          name="tags"
                          placeholder="Tags (comma-separated)"
                          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:bg-gray-700 dark:text-gray-100"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2">
                {uploadProvider ? (
                  <p className="text-center text-xs text-blue-600 dark:text-blue-400">
                    Using{" "}
                    {uploadProvider === "nostr"
                      ? "NOSTR"
                      : uploadProvider.toUpperCase()}{" "}
                    upload provider
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={onBulkFileUpload}
                  disabled={bulkFileUploading}
                  className="w-full rounded-lg bg-green-600 px-4 py-3 text-lg font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {bulkFileUploading
                    ? "Uploading..."
                    : `Upload All ${bulkUploadFiles.length} Media Files`}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
