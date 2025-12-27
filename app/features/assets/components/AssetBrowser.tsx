import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import type { Asset } from "~/features/assets/types";
interface AssetBrowserProps {
  assets: Asset[];
  onAssetsSelected: (selectedAssets: Asset[]) => void;
  onClose: () => void;
}

export default function AssetBrowser({
  assets,
  onAssetsSelected,
  onClose,
}: AssetBrowserProps) {
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAssets = assets.filter((asset) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      asset.title?.toLowerCase().includes(searchLower) ||
      asset.content?.toLowerCase().includes(searchLower) ||
      asset.tags?.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  });

  const handleAssetSelect = (assetId: string) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId],
    );
  };

  const handleSelectAll = () => {
    if (selectedAssets.length === filteredAssets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(filteredAssets.map((asset) => asset.id));
    }
  };

  const handleConfirmSelection = () => {
    const selectedAssetObjects = assets.filter((asset) =>
      selectedAssets.includes(asset.id),
    );
    onAssetsSelected(selectedAssetObjects);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg bg-white dark:bg-gray-800">
        <div className="border-b border-gray-200 p-6 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Assets
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                placeholder="Search assets by title, content, or tags..."
              />
            </div>

            <div className="flex items-center gap-2">
              {filteredAssets.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedAssets.length === filteredAssets.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              ) : null}

              {selectedAssets.length > 0 ? (
                <Button
                  type="button"
                  onClick={handleConfirmSelection}
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  Add Selected ({selectedAssets.length})
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto p-6">
          {filteredAssets.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto max-w-md">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">
                  {searchTerm
                    ? "No matching assets found"
                    : "No assets available"}
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {searchTerm
                    ? "Try adjusting your search terms"
                    : "Create assets in the Templates section first"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAssets.map((asset) => {
                const handleKeyDown = (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAssetSelect(asset.id);
                  }
                };

                return (
                  <div
                    key={asset.id}
                    className={`cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md ${
                      selectedAssets.includes(asset.id)
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    }`}
                    onClick={() => handleAssetSelect(asset.id)}
                    onKeyDown={handleKeyDown}
                    role="button"
                    tabIndex={0}
                  >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={selectedAssets.includes(asset.id)}
                      onChange={() => handleAssetSelect(asset.id)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        {asset.assetType === "IMAGE" ? (
                          <img
                            src={asset.fileUrl ?? undefined}
                            alt={asset.title ?? "Asset"}
                            className="h-8 w-8 flex-shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            T
                          </div>
                        )}

                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            asset.assetType === "IMAGE"
                              ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          }`}
                        >
                          {asset.assetType}
                        </span>
                      </div>

                      <h3 className="truncate font-medium text-gray-900 dark:text-gray-100">
                        {asset.title ?? "Untitled"}
                      </h3>

                      {asset.assetType === "TEXT" && asset.content ? (
                        <p className="mt-1 line-clamp-2 text-sm text-gray-600 dark:text-gray-400">
                          {asset.content}
                        </p>
                      ) : null}

                      {asset.tags && asset.tags.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {asset.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                            >
                              {tag}
                            </span>
                          ))}
                          {asset.tags.length > 2 ? (
                            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              +{asset.tags.length - 2}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
