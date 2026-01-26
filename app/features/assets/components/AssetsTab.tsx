import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { formatDate } from "~/lib/helpers";
interface Asset {
  id: string;
  assetType: string;
  fileUrl?: string;
  content?: string | null;
  title?: string | null;
  tags?: string[];
  createdAt: string | Date;
}

interface AssetsTabProps {
  assets: Asset[];
  selectedAssets: string[];
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearch: (e: React.FormEvent) => void;
  onAssetSelect: (assetId: string) => void;
  onSelectAllAssets: () => void;
  onBulkPostAssets: () => void;
  onBulkDeleteAssets: () => void;
  deleteFetcherState: "idle" | "submitting" | "loading";
  deleteFetcherForm: React.ComponentType<{
    children: React.ReactNode;
    method: string;
    className?: string;
  }>;
  onDeleteAsset: (
    e: React.MouseEvent<HTMLButtonElement>,
    assetId: string
  ) => void;
}

export function AssetsTab({
  assets,
  selectedAssets,
  searchInput,
  onSearchInputChange,
  onSearch,
  onAssetSelect,
  onSelectAllAssets,
  onBulkPostAssets,
  onBulkDeleteAssets,
  deleteFetcherState,
  deleteFetcherForm: DeleteFetcherForm,
  onDeleteAsset,
}: AssetsTabProps) {
  return (
    <div>
      {/* Search and Controls */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <form onSubmit={onSearch} className="flex max-w-md flex-1">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <svg
                className="text-foreground h-5 w-5"
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
            <input
              id="assets-search"
              name="assets-search"
              type="text"
              value={searchInput}
              onChange={(e) => onSearchInputChange(e.target.value)}
              className="dark:border-border dark:bg-card dark:focus:border-primary border-border placeholder-muted-foreground focus:border-primary focus:ring-primary/50 block w-full rounded-lg border py-2 pr-3 pl-10 text-sm leading-6 focus:ring"
              placeholder="Search assets by title, content, or tags..."
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-primary-foreground hover:bg-primary/90 ml-2 rounded-lg px-4 py-2"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-4">
          {selectedAssets.length > 0 ? (
            <button
              onClick={onBulkPostAssets}
              className="bg-success hover:bg-success/90 rounded-lg px-4 py-2 text-white"
            >
              Post Selected ({selectedAssets.length})
            </button>
          ) : null}
          {selectedAssets.length > 0 ? (
            <button
              onClick={onBulkDeleteAssets}
              disabled={deleteFetcherState !== "idle"}
              className="bg-destructive hover:bg-destructive/90 rounded-lg px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleteFetcherState !== "idle"
                ? "Deleting..."
                : `Delete Selected (${selectedAssets.length})`}
            </button>
          ) : null}
          {assets.length > 0 ? (
            <button
              onClick={onSelectAllAssets}
              className="dark:border-border dark:text-foreground dark:hover:bg-muted border-border text-muted-foreground hover:bg-muted rounded-lg border px-4 py-2"
            >
              {selectedAssets.length === assets.length
                ? "Deselect All"
                : "Select All"}
            </button>
          ) : null}
        </div>
      </div>

      {/* Assets List */}
      {assets.length === 0 ? (
        <div className="py-12 text-center">
          <div className="mx-auto max-w-md">
            <svg
              className="text-foreground mx-auto h-12 w-12"
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
            <h3 className="dark:text-foreground text-foreground mt-4 text-lg font-medium">
              No assets yet
            </h3>
            <p className="dark:text-muted-foreground text-muted-foreground mt-2 text-sm">
              Create your first asset by adding text or uploading an image
            </p>
          </div>
        </div>
      ) : (
        <div className="dark:border-border bg-card border-border min-w-full overflow-x-auto rounded border bg-white">
          <table className="min-w-full align-middle text-sm whitespace-nowrap">
            <thead>
              <tr>
                <th className="dark:bg-card dark:border-border bg-muted text-foreground dark:text-foreground px-3 py-4 text-center font-semibold">
                  <input
                    type="checkbox"
                    checked={
                      assets.length > 0
                        ? selectedAssets.length === assets.length
                        : false
                    }
                    onChange={onSelectAllAssets}
                    className="dark:border-border dark:bg-card border-border accent-checkbox focus:ring-checkbox h-4 w-4 rounded"
                  />
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Media
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Title
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Content
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Tags
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Type
                </th>
                <th className="dark:bg-card dark:border-border bg-muted/75 text-foreground dark:text-foreground px-3 py-4 text-left font-semibold">
                  Created
                </th>
                <th className="dark:bg-card dark:border-border bg-muted text-foreground dark:text-foreground px-3 py-4 text-center font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => (
                <tr
                  key={asset.id}
                  className="dark:even:bg-muted/35 dark:hover:bg-muted even:bg-muted/50 hover:bg-muted"
                >
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedAssets.includes(asset.id)}
                      onChange={() => onAssetSelect(asset.id)}
                      className="dark:border-border dark:bg-card border-border accent-checkbox focus:ring-checkbox h-4 w-4 rounded"
                    />
                  </td>
                  <td className="p-3">
                    {asset.assetType === "IMAGE" ||
                    asset.assetType === "VIDEO" ? (
                      <MediaThumbnail
                        src={asset.fileUrl ?? ""}
                        alt={asset.title ?? "Asset"}
                        className="h-12 w-12 rounded object-cover"
                      />
                    ) : (
                      <div className="dark:bg-muted dark:text-muted-foreground bg-muted text-foreground flex h-12 w-12 items-center justify-center rounded text-xs font-medium">
                        TEXT
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <p className="font-medium">{asset.title ?? "Untitled"}</p>
                  </td>
                  <td className="p-3">
                    {asset.assetType === "TEXT" && asset.content ? (
                      <p className="max-w-xs truncate">{asset.content}</p>
                    ) : (
                      <p className="text-foreground">-</p>
                    )}
                  </td>
                  <td className="p-3">
                    {asset.tags && asset.tags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.slice(0, 3).map((tag: string) => (
                          <span
                            key={tag}
                            className="dark:bg-muted dark:text-foreground bg-muted text-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                        {asset.tags.length > 3 ? (
                          <span className="dark:bg-muted dark:text-foreground bg-muted text-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                            +{asset.tags.length - 3}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-foreground">-</p>
                    )}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        asset.assetType === "IMAGE"
                          ? "bg-muted text-foreground"
                          : asset.assetType === "VIDEO"
                            ? "bg-destructive/10 text-destructive dark:bg-destructive/20 dark:text-destructive"
                            : "bg-muted text-foreground dark:bg-muted dark:text-foreground"
                      }`}
                    >
                      {asset.assetType}
                    </span>
                  </td>
                  <td className="p-3">{formatDate(asset.createdAt)}</td>
                  <td className="p-3 text-center">
                    <DeleteFetcherForm method="post" className="inline">
                      <input
                        type="hidden"
                        name="_action"
                        value="delete_asset"
                      />
                      <input type="hidden" name="assetId" value={asset.id} />
                      <button
                        type="submit"
                        onClick={(e) => onDeleteAsset(e, asset.id)}
                        disabled={deleteFetcherState !== "idle"}
                        className="dark:bg-card border-destructive text-destructive hover:border-destructive hover:text-destructive focus:ring-destructive/25 active:border-destructive dark:border-destructive dark:text-destructive dark:hover:border-destructive dark:hover:text-destructive dark:focus:ring-destructive/40 dark:active:border-destructive inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </DeleteFetcherForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
