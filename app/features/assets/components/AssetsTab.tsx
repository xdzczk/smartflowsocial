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
    onDeleteAsset: (e: React.MouseEvent<HTMLButtonElement>, assetId: string) => void;
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
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => onSearchInputChange(e.target.value)}
                            className="block w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm leading-6 placeholder-gray-400 focus:border-blue-500 focus:ring focus:ring-blue-500/50 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-blue-500"
                            placeholder="Search assets by title, content, or tags..."
                        />
                    </div>
                    <button
                        type="submit"
                        className="ml-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                        Search
                    </button>
                </form>

                <div className="flex items-center gap-4">
                    {selectedAssets.length > 0 ? (
                        <button
                            onClick={onBulkPostAssets}
                            className="rounded-lg bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                        >
                            Post Selected ({selectedAssets.length})
                        </button>
                    ) : null}
                    {selectedAssets.length > 0 ? (
                        <button
                            onClick={onBulkDeleteAssets}
                            disabled={deleteFetcherState !== "idle"}
                            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {deleteFetcherState !== "idle"
                                ? "Deleting..."
                                : `Delete Selected (${selectedAssets.length})`}
                        </button>
                    ) : null}
                    {assets.length > 0 ? (
                        <button
                            onClick={onSelectAllAssets}
                            className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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
                            No assets yet
                        </h3>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                            Create your first asset by adding text or uploading an
                            image
                        </p>
                    </div>
                </div>
            ) : (
                <div className="min-w-full overflow-x-auto rounded border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
                    <table className="min-w-full whitespace-nowrap align-middle text-sm">
                        <thead>
                            <tr>
                                <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    <input
                                        type="checkbox"
                                        checked={
                                            assets.length > 0
                                                ? selectedAssets.length === assets.length
                                                : false
                                        }
                                        onChange={onSelectAllAssets}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
                                    />
                                </th>
                                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    Media
                                </th>
                                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    Title
                                </th>
                                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    Content
                                </th>
                                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    Tags
                                </th>
                                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    Type
                                </th>
                                <th className="bg-gray-100/75 px-3 py-4 text-left font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    Created
                                </th>
                                <th className="bg-gray-100/75 px-3 py-4 text-center font-semibold text-gray-900 dark:bg-gray-700/25 dark:text-gray-50">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {assets.map((asset) => (
                                <tr
                                    key={asset.id}
                                    className="even:bg-gray-50 hover:bg-gray-100 dark:even:bg-gray-900/50 dark:hover:bg-gray-700/50"
                                >
                                    <td className="p-3 text-center">
                                        <input
                                            type="checkbox"
                                            checked={selectedAssets.includes(asset.id)}
                                            onChange={() => onAssetSelect(asset.id)}
                                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700"
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
                                            <div className="flex h-12 w-12 items-center justify-center rounded bg-gray-200 text-xs font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                                TEXT
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <p className="font-medium">
                                            {asset.title ?? "Untitled"}
                                        </p>
                                    </td>
                                    <td className="p-3">
                                        {asset.assetType === "TEXT" && asset.content ? (
                                            <p className="max-w-xs truncate">
                                                {asset.content}
                                            </p>
                                        ) : (
                                            <p className="text-gray-400">-</p>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        {asset.tags && asset.tags.length > 0 ? (
                                            <div className="flex flex-wrap gap-1">
                                                {asset.tags
                                                    .slice(0, 3)
                                                    .map((tag: string, index: number) => (
                                                        <span
                                                            key={index}
                                                            className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                {asset.tags.length > 3 ? (
                                                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                                                        +{asset.tags.length - 3}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : (
                                            <p className="text-gray-400">-</p>
                                        )}
                                    </td>
                                    <td className="p-3">
                                        <span
                                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${asset.assetType === "IMAGE"
                                                ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                                : asset.assetType === "VIDEO"
                                                    ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                                    : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                                }`}
                                        >
                                            {asset.assetType}
                                        </span>
                                    </td>
                                    <td className="p-3">{formatDate(asset.createdAt)}</td>
                                    <td className="p-3 text-center">
                                        <DeleteFetcherForm
                                            method="post"
                                            className="inline"
                                        >
                                            <input
                                                type="hidden"
                                                name="_action"
                                                value="delete_asset"
                                            />
                                            <input
                                                type="hidden"
                                                name="assetId"
                                                value={asset.id}
                                            />
                                            <button
                                                type="submit"
                                                onClick={(e) => onDeleteAsset(e, asset.id)}
                                                disabled={deleteFetcherState !== "idle"}
                                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-2 py-1 text-sm font-semibold leading-5 text-red-800 hover:border-red-300 hover:text-red-900 hover:shadow-sm focus:ring focus:ring-red-300/25 active:border-red-200 active:shadow-none disabled:opacity-50 dark:border-red-700 dark:bg-gray-800 dark:text-red-300 dark:hover:border-red-600 dark:hover:text-red-200 dark:focus:ring-red-600/40 dark:active:border-red-700"
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
