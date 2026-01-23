import { Outlet } from "@remix-run/react";
import { useEffect } from "react";

import { AssetsTab, UploadTab } from "~/features/assets";
import { useIntersectionObserver } from "~/lib/hooks/useIntersectionObserver";

import { useTemplatesInfiniteData } from "../hooks/useTemplatesQuery";
import { useTemplatesState } from "../hooks/useTemplatesState";

import { TemplateDetailsModal } from "./TemplateDetailsModal";
import { TemplatesHeader } from "./TemplatesHeader";
import { TemplatesTabs } from "./TemplatesTabs";
import { ToastNotification } from "./ToastNotification";

export default function TemplatesPage() {
  // Use infinite query for data fetching with infinite scroll
  const { assets, searchTerm, isFetchingNextPage, hasNextPage, fetchNextPage } =
    useTemplatesInfiniteData();

  // Set up intersection observer for infinite scroll
  const { ref: sentinelRef, isIntersecting } = useIntersectionObserver({
    threshold: 0.8,
  });

  // Prefetch sentinel - triggers earlier (70% threshold) to prefetch next page
  const { ref: prefetchSentinelRef, isIntersecting: isPrefetchIntersecting } =
    useIntersectionObserver({
      threshold: 0.7,
    });

  // Prefetch next page when user is 70% down (earlier than actual fetch at 80%)
  useEffect(() => {
    if (
      isPrefetchIntersecting &&
      hasNextPage &&
      !isFetchingNextPage &&
      !isIntersecting
    ) {
      // Prefetch by calling fetchNextPage early
      void fetchNextPage();
    }
  }, [
    isPrefetchIntersecting,
    hasNextPage,
    isFetchingNextPage,
    isIntersecting,
    fetchNextPage,
  ]);

  // Fetch next page when sentinel becomes visible (backup in case prefetch didn't trigger)
  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const {
    selectedTemplate,
    activeTab,
    selectedAssets,
    searchInput,
    bulkUploadFiles,
    showToast,
    toastMessage,
    uploadProvider,
    singleFileUploading,
    bulkFileUploading,
    textAssetFormRef,
    imageAssetFormRef,
    isOnChildRoute,
    deleteFetcher,
    scheduleFetcher: _scheduleFetcher,
    assetFetcher,
    setSelectedTemplate,
    setActiveTab,
    setSearchInput,
    handleAssetSelect,
    handleSelectAllAssets,
    handleBulkPostAssets,
    handleBulkDeleteAssets,
    handleSearch,
    handleDeleteAsset,
    handleSingleFileUpload,
    handleBulkFileUpload,
    handleBulkFileChange,
  } = useTemplatesState({ searchTerm });

  return (
    <>
      {/* Only show parent content when NOT on a child route */}
      {!isOnChildRoute ? (
        <div className="p-6">
          <TemplatesHeader />

          <TemplatesTabs activeTab={activeTab} onTabChange={setActiveTab} />

          {/* Tab Content */}
          {activeTab === "assets" ? (
            <>
              <AssetsTab
                assets={
                  Array.isArray(assets)
                    ? assets
                        .filter(
                          (
                            asset: unknown
                          ): asset is {
                            id: string;
                            title?: unknown;
                            content?: unknown;
                            fileUrl?: unknown;
                            tags?: unknown;
                            assetType?: unknown;
                            createdAt?: unknown;
                            updatedAt?: unknown;
                          } =>
                            typeof asset === "object" &&
                            asset !== null &&
                            "id" in asset &&
                            typeof (asset as { id: unknown }).id === "string"
                        )
                        .map((asset) => ({
                          id: asset.id,
                          assetType:
                            typeof asset.assetType === "string"
                              ? asset.assetType
                              : "IMAGE",
                          fileUrl:
                            typeof asset.fileUrl === "string"
                              ? asset.fileUrl
                              : undefined,
                          content:
                            typeof asset.content === "string"
                              ? asset.content
                              : undefined,
                          title:
                            typeof asset.title === "string"
                              ? asset.title
                              : undefined,
                          tags: Array.isArray(asset.tags)
                            ? asset.tags.filter(
                                (tag): tag is string => typeof tag === "string"
                              )
                            : [],
                          createdAt: (() => {
                            const createdAtValue: unknown = asset.createdAt;
                            if (createdAtValue instanceof Date)
                              return createdAtValue.toISOString();
                            if (typeof createdAtValue === "string")
                              return createdAtValue;
                            return new Date().toISOString();
                          })(),
                          updatedAt: (() => {
                            const updatedAtValue: unknown = asset.updatedAt;
                            if (updatedAtValue instanceof Date)
                              return updatedAtValue.toISOString();
                            if (typeof updatedAtValue === "string")
                              return updatedAtValue;
                            return new Date().toISOString();
                          })(),
                        }))
                    : []
                }
                selectedAssets={selectedAssets}
                searchInput={searchInput}
                onSearchInputChange={setSearchInput}
                onSearch={handleSearch}
                onAssetSelect={handleAssetSelect}
                onSelectAllAssets={() => handleSelectAllAssets(assets)}
                onBulkPostAssets={() => handleBulkPostAssets(assets)}
                onBulkDeleteAssets={handleBulkDeleteAssets}
                deleteFetcherState={deleteFetcher.state}
                deleteFetcherForm={
                  deleteFetcher.Form as unknown as React.ComponentType<{
                    children: React.ReactNode;
                    method: string;
                    className?: string;
                  }>
                }
                onDeleteAsset={handleDeleteAsset}
              />
              {/* Scroll sentinel for infinite scroll */}
              {/* Prefetch sentinel - triggers at 70% to prefetch next page */}
              <div ref={prefetchSentinelRef} className="h-4 w-full" />
              {/* Main sentinel - triggers at 80% to ensure next page is loaded */}
              <div ref={sentinelRef} className="h-4 w-full" />

              {/* Loading indicator for next page */}
              {isFetchingNextPage ? (
                <div className="mt-4 text-center text-sm text-gray-500">
                  Loading more assets...
                </div>
              ) : null}
            </>
          ) : (
            <UploadTab
              textAssetFormRef={
                textAssetFormRef as React.RefObject<HTMLFormElement>
              }
              imageAssetFormRef={
                imageAssetFormRef as React.RefObject<HTMLFormElement>
              }
              assetFetcher={{
                Form: assetFetcher.Form as unknown as React.ComponentType<{
                  children: React.ReactNode;
                  method: string;
                  className?: string;
                }>,
                state: assetFetcher.state,
              }}
              uploadProvider={uploadProvider}
              bulkUploadFiles={bulkUploadFiles}
              singleFileUploading={singleFileUploading}
              bulkFileUploading={bulkFileUploading}
              onSingleFileUpload={(e, form) =>
                void handleSingleFileUpload(e, form)
              }
              onBulkFileUpload={() => void handleBulkFileUpload()}
              onBulkFileChange={(e) => void handleBulkFileChange(e)}
            />
          )}

          {/* Toast Notification */}
          {showToast ? (
            <ToastNotification
              message={toastMessage}
              onClose={() => {
                // Toast close handler
              }}
            />
          ) : null}

          {/* Template Details Modal */}
          {selectedTemplate ? (
            <TemplateDetailsModal
              template={{
                id: selectedTemplate.id,
                name: selectedTemplate.name ?? "",
                text: null,
                imageUrl: null,
                createdAt:
                  selectedTemplate.createdAt instanceof Date
                    ? selectedTemplate.createdAt
                    : new Date(selectedTemplate.createdAt),
              }}
              onClose={() => setSelectedTemplate(null)}
            />
          ) : null}
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
