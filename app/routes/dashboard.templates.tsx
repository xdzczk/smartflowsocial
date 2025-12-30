import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Outlet } from "@remix-run/react";

import {
  AssetPagination,
  AssetsTab,
  UploadTab,
  type Asset,
} from "~/features/assets";
import { requireUserId } from "~/features/auth";
import {
  requireFeatureAccess,
  requireAnySubscription,
} from "~/features/payments";
import {
  TemplateDetailsModal,
  TemplatesHeader,
  TemplatesTabs,
  ToastNotification,
  useTemplatesState,
  handleTemplatesAction,
  loadTemplatesData,
} from "~/features/templates";
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to templates feature
  await requireFeatureAccess(userId, "templates");

  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search") ?? "";
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = 100;

  const data = await loadTemplatesData(userId, searchTerm, page, limit);
  return json(data);
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    const userId = await requireUserId(request);
    const formData = await request.formData();
    const result = await handleTemplatesAction(formData, userId);
    
    if (result.error) {
      return json(result, { status: 400 });
    }
    
    return json(result);
  } catch (error) {
    const { handleActionError } = await import("~/lib/error-handler.server");
    return handleActionError(error);
  }
}

export default function Templates() {
  const loaderData = useLoaderData<typeof loader>();
  const assets = "assets" in loaderData && Array.isArray(loaderData.assets) ? loaderData.assets : [];
  const totalCount = "totalCount" in loaderData && typeof loaderData.totalCount === "number" ? loaderData.totalCount : 0;
  const totalPages = "totalPages" in loaderData && typeof loaderData.totalPages === "number" ? loaderData.totalPages : 0;
  const currentPage = "currentPage" in loaderData && typeof loaderData.currentPage === "number" ? loaderData.currentPage : 1;
  const searchTerm = "searchTerm" in loaderData && typeof loaderData.searchTerm === "string" ? loaderData.searchTerm : "";

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
    handlePageChange,
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
                assets={Array.isArray(assets) ? assets
                  .filter((asset: unknown): asset is { id: string; title?: unknown; content?: unknown; fileUrl?: unknown; tags?: unknown; assetType?: unknown; createdAt?: unknown; updatedAt?: unknown } => 
                    typeof asset === "object" && asset !== null && "id" in asset && typeof (asset as { id: unknown }).id === "string"
                  )
                  .map((asset) => ({
                    id: asset.id,
                    assetType: typeof asset.assetType === "string" ? asset.assetType : "IMAGE",
                    fileUrl: typeof asset.fileUrl === "string" ? asset.fileUrl : undefined,
                    content: typeof asset.content === "string" ? asset.content : asset.content === null ? null : undefined,
                    title: typeof asset.title === "string" ? asset.title : asset.title === null ? null : undefined,
                    tags: Array.isArray(asset.tags) ? asset.tags.filter((tag): tag is string => typeof tag === "string") : [],
                    createdAt: (() => {
                      const createdAtValue: unknown = asset.createdAt;
                      if (createdAtValue instanceof Date) return createdAtValue.toISOString();
                      if (typeof createdAtValue === "string") return createdAtValue;
                      return new Date().toISOString();
                    })(),
                    updatedAt: (() => {
                      const updatedAtValue: unknown = asset.updatedAt;
                      if (updatedAtValue instanceof Date) return updatedAtValue.toISOString();
                      if (typeof updatedAtValue === "string") return updatedAtValue;
                      return new Date().toISOString();
                    })(),
                  })) : []}
                selectedAssets={selectedAssets}
                searchInput={searchInput}
                onSearchInputChange={setSearchInput}
                onSearch={handleSearch}
                onAssetSelect={handleAssetSelect}
                onSelectAllAssets={() => handleSelectAllAssets(Array.isArray(assets) ? assets as unknown as Asset[] : [])}
                onBulkPostAssets={() => handleBulkPostAssets(Array.isArray(assets) ? assets as unknown as Asset[] : [])}
                onBulkDeleteAssets={handleBulkDeleteAssets}
                deleteFetcherState={deleteFetcher.state}
                deleteFetcherForm={deleteFetcher.Form as unknown as React.ComponentType<{ children: React.ReactNode; method: string; className?: string }>}
                onDeleteAsset={handleDeleteAsset}
              />
              <AssetPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={handlePageChange}
              />
            </>
          ) : (
            <UploadTab
              textAssetFormRef={textAssetFormRef}
              imageAssetFormRef={imageAssetFormRef}
              assetFetcher={{
                Form: assetFetcher.Form as unknown as React.ComponentType<{ children: React.ReactNode; method: string; className?: string }>,
                state: assetFetcher.state,
              }}
              uploadProvider={uploadProvider}
              bulkUploadFiles={bulkUploadFiles}
              singleFileUploading={singleFileUploading}
              bulkFileUploading={bulkFileUploading}
              onSingleFileUpload={(e, form) => void handleSingleFileUpload(e, form)}
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
                createdAt: selectedTemplate.createdAt instanceof Date ? selectedTemplate.createdAt : new Date(selectedTemplate.createdAt),
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
