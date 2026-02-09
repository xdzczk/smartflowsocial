import { FolderOpen, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { INLINE_ICON_STROKE } from "~/lib/icon-constants";

import type { Asset } from "../types";
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
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      asset.title?.toLowerCase().includes(searchLower) ||
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Boolean OR for filter logic
      asset.content?.toLowerCase().includes(searchLower) ||
      asset.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  });

  const handleAssetSelect = (assetId: string) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId]
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
      selectedAssets.includes(asset.id)
    );
    onAssetsSelected(selectedAssetObjects);
    onClose();
  };

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="border-border bg-card max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-lg border">
        <div className="border-border border-b p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-xl font-semibold">
              Select Assets
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Search
                  className="text-muted-foreground h-5 w-5"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
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
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
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
                <FolderOpen
                  className="text-muted-foreground mx-auto h-12 w-12"
                  strokeWidth={INLINE_ICON_STROKE}
                  aria-hidden
                />
                <h3 className="text-foreground mt-4 text-lg font-medium">
                  {searchTerm
                    ? "No matching assets found"
                    : "No assets available"}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
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
                        ? "border-primary dark:bg-muted bg-muted"
                        : "border-border bg-card"
                    }`}
                    onClick={() => handleAssetSelect(asset.id)}
                    onKeyDown={handleKeyDown}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedAssets.includes(asset.id)}
                        onCheckedChange={() => handleAssetSelect(asset.id)}
                        className="mt-1"
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
                            <div className="bg-muted text-muted-foreground flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-xs font-medium">
                              T
                            </div>
                          )}

                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              asset.assetType === "IMAGE"
                                ? "bg-muted text-muted-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {asset.assetType}
                          </span>
                        </div>

                        <h3 className="text-foreground truncate font-medium">
                          {asset.title ?? "Untitled"}
                        </h3>

                        {asset.assetType === "TEXT" && asset.content ? (
                          <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
                            {asset.content}
                          </p>
                        ) : null}

                        {asset.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {asset.tags.slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                            {asset.tags.length > 2 ? (
                              <span className="dark:bg-muted dark:text-foreground bg-muted text-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
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
