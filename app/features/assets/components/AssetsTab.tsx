import { useVirtualizer } from "@tanstack/react-virtual";
import { FolderOpen } from "lucide-react";
import { useRef } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import MediaThumbnail from "~/components/ui/MediaThumbnail";
import { useFormattedDate } from "~/lib/hooks/useFormattedDate";
import { useIsMobile } from "~/lib/hooks/useIsMobile";

import { AssetListCard } from "./AssetListCard";

const ASSETS_MOBILE_BREAKPOINT_PX = 768;

function getAssetsScrollElement(
  useDedicatedScroll: boolean,
  scrollRef: React.RefObject<HTMLDivElement | null>
): Element | null {
  if (useDedicatedScroll && scrollRef.current) return scrollRef.current;
  return typeof document !== "undefined" ? document.documentElement : null;
}

function AssetsTabControls({
  assetsLength,
  selectedCount,
  deleteFetcherState,
  onBulkPostAssets,
  onBulkDeleteAssets,
  onSelectAllAssets,
}: {
  assetsLength: number;
  selectedCount: number;
  deleteFetcherState: "idle" | "submitting" | "loading";
  onBulkPostAssets: () => void;
  onBulkDeleteAssets: () => void;
  onSelectAllAssets: () => void;
}) {
  const hasSelection = selectedCount > 0;
  const hasAssets = assetsLength > 0;
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
      <div className="flex items-center gap-4">
        {hasSelection ? (
          <button
            onClick={onBulkPostAssets}
            className="bg-success hover:bg-success/90 rounded-lg px-4 py-2 text-white"
          >
            Post Selected ({selectedCount})
          </button>
        ) : null}
        {hasSelection ? (
          <button
            onClick={onBulkDeleteAssets}
            disabled={deleteFetcherState !== "idle"}
            className="bg-destructive hover:bg-destructive/90 rounded-lg px-4 py-2 text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteFetcherState !== "idle"
              ? "Deleting..."
              : `Delete Selected (${selectedCount})`}
          </button>
        ) : null}
        {hasAssets ? (
          <button
            onClick={onSelectAllAssets}
            className="dark:border-border dark:text-foreground dark:hover:bg-muted border-border text-muted-foreground hover:bg-muted rounded-lg border px-4 py-2"
          >
            {selectedCount === assetsLength ? "Deselect All" : "Select All"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function AssetsEmptyState() {
  return (
    <div className="py-12 text-center">
      <div className="mx-auto max-w-md">
        <FolderOpen
          className="text-foreground mx-auto h-12 w-12"
          strokeWidth={2}
          aria-hidden
        />
        <h3 className="dark:text-foreground text-foreground mt-4 text-lg font-medium">
          No assets yet
        </h3>
        <p className="dark:text-muted-foreground text-muted-foreground mt-2 text-sm">
          Create your first asset by adding text or uploading an image
        </p>
      </div>
    </div>
  );
}

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
  prefetchSentinelRef?: React.Ref<HTMLDivElement | null>;
  sentinelRef?: React.Ref<HTMLDivElement | null>;
  isFetchingNextPage?: boolean;
  onScrollContainerReady?: (el: HTMLDivElement | null) => void;
}

/* eslint-disable sonarjs/cognitive-complexity -- Tab layout: controls, empty state, desktop table, and mobile virtual list */
export function AssetsTab({
  assets,
  selectedAssets,
  searchInput: _searchInput,
  onSearchInputChange: _onSearchInputChange,
  onSearch: _onSearch,
  onAssetSelect,
  onSelectAllAssets,
  onBulkPostAssets,
  onBulkDeleteAssets,
  deleteFetcherState,
  deleteFetcherForm: DeleteFetcherForm,
  onDeleteAsset,
  prefetchSentinelRef,
  sentinelRef,
  isFetchingNextPage = false,
  onScrollContainerReady,
}: AssetsTabProps) {
  const { formatDate } = useFormattedDate();
  const isMobile = useIsMobile(ASSETS_MOBILE_BREAKPOINT_PX);
  const mobileScrollContainerRef = useRef<HTMLDivElement | null>(null);
  const useDedicatedScroll =
    isMobile && (sentinelRef != null || onScrollContainerReady != null);

  // eslint-disable-next-line react-hooks/incompatible-library -- useVirtualizer is not memoization-safe by design
  const rowVirtualizer = useVirtualizer({
    count: assets.length,
    getScrollElement: () =>
      getAssetsScrollElement(useDedicatedScroll, mobileScrollContainerRef),
    estimateSize: () => 98,
    overscan: 3,
    getItemKey: (index) => assets[index]?.id ?? String(index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div>
      <AssetsTabControls
        assetsLength={assets.length}
        selectedCount={selectedAssets.length}
        deleteFetcherState={deleteFetcherState}
        onBulkPostAssets={onBulkPostAssets}
        onBulkDeleteAssets={onBulkDeleteAssets}
        onSelectAllAssets={onSelectAllAssets}
      />

      {assets.length === 0 ? (
        <AssetsEmptyState />
      ) : (
        <>
          {/* Desktop: table (hidden on mobile) */}
          <div className="hidden md:block">
            <div className="dark:border-border bg-card border-border min-w-full overflow-x-auto rounded border bg-white">
              <table className="min-w-full align-middle text-sm whitespace-nowrap">
                <thead>
                  <tr>
                    <th className="dark:bg-card dark:border-border bg-muted text-foreground dark:text-foreground px-3 py-4 text-center font-semibold">
                      <Checkbox
                        checked={
                          assets.length > 0
                            ? selectedAssets.length === assets.length
                            : false
                        }
                        onCheckedChange={() => onSelectAllAssets()}
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
                        <Checkbox
                          checked={selectedAssets.includes(asset.id)}
                          onCheckedChange={() => onAssetSelect(asset.id)}
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
                        <p className="font-medium">
                          {asset.title ?? "Untitled"}
                        </p>
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
                          <input
                            type="hidden"
                            name="assetId"
                            value={asset.id}
                          />
                          <button
                            type="submit"
                            onClick={(e) => onDeleteAsset(e, asset.id)}
                            disabled={deleteFetcherState !== "idle"}
                            className="dark:bg-card border-destructive text-destructive hover:border-destructive hover:text-destructive focus:ring-ring/25 active:border-destructive dark:border-destructive dark:text-destructive dark:hover:border-destructive dark:hover:text-destructive dark:focus:ring-ring/40 dark:active:border-destructive inline-flex items-center justify-center gap-2 rounded-lg border bg-white px-2 py-1 text-sm leading-5 font-semibold hover:shadow-sm focus:ring active:shadow-none disabled:opacity-50"
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
          </div>

          {/* Mobile: virtualized asset card list */}
          {isMobile ? (
            <div className="block md:hidden">
              {useDedicatedScroll ? (
                <div
                  ref={(el) => {
                    mobileScrollContainerRef.current = el;
                    onScrollContainerReady?.(el ?? null);
                  }}
                  className="overflow-auto"
                  style={{ height: "calc(100vh - 14rem)" }}
                >
                  {assets.length > 0 ? (
                    <>
                      <div
                        style={{
                          height: rowVirtualizer.getTotalSize(),
                          position: "relative",
                          width: "100%",
                        }}
                      >
                        {virtualItems.map((virtualRow) => {
                          const asset = assets[virtualRow.index];
                          if (!asset) return null;
                          return (
                            <div
                              key={virtualRow.key}
                              data-index={virtualRow.index}
                              className="pb-0.5"
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                            >
                              <AssetListCard
                                asset={asset}
                                selected={selectedAssets.includes(asset.id)}
                                onSelect={onAssetSelect}
                                deleteFetcherForm={DeleteFetcherForm}
                                onDeleteAsset={onDeleteAsset}
                                deleteFetcherState={deleteFetcherState}
                              />
                            </div>
                          );
                        })}
                      </div>
                      {prefetchSentinelRef ? (
                        <div ref={prefetchSentinelRef} className="h-4 w-full" />
                      ) : null}
                      {sentinelRef ? (
                        <div ref={sentinelRef} className="h-4 w-full" />
                      ) : null}
                      {isFetchingNextPage ? (
                        <div className="text-muted-foreground py-4 text-center text-sm">
                          Loading more...
                        </div>
                      ) : null}
                    </>
                  ) : null}
                </div>
              ) : assets.length > 0 ? (
                <div
                  style={{
                    height: rowVirtualizer.getTotalSize(),
                    position: "relative",
                    width: "100%",
                  }}
                >
                  {virtualItems.map((virtualRow) => {
                    const asset = assets[virtualRow.index];
                    if (!asset) return null;
                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        className="pb-0.5"
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: "100%",
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <AssetListCard
                          asset={asset}
                          selected={selectedAssets.includes(asset.id)}
                          onSelect={onAssetSelect}
                          deleteFetcherForm={DeleteFetcherForm}
                          onDeleteAsset={onDeleteAsset}
                          deleteFetcherState={deleteFetcherState}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
  /* eslint-enable sonarjs/cognitive-complexity */
}
