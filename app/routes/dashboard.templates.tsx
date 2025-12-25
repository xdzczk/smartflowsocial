import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Outlet } from "@remix-run/react";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import { AssetsTab } from "~/features/assets/components/AssetsTab";
import { AssetPagination } from "~/features/assets/components/AssetPagination";
import { UploadTab } from "~/features/assets/components/UploadTab";
import { TemplateDetailsModal } from "~/features/templates/components/TemplateDetailsModal";
import { TemplatesHeader } from "~/features/templates/components/TemplatesHeader";
import { TemplatesTabs } from "~/features/templates/components/TemplatesTabs";
import { ToastNotification } from "~/features/templates/components/ToastNotification";
import { useTemplatesState } from "~/features/templates/hooks/useTemplatesState";
import { loadTemplatesData } from "~/features/templates/services/templates-loader.server";
import { handleTemplatesAction } from "~/features/templates/services/templates-action.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to templates feature
  await requireFeatureAccess(userId, "templates");

  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
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
  const {
    assets,
    totalCount,
    totalPages,
    currentPage,
    searchTerm,
  } = useLoaderData<typeof loader>();

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
    scheduleFetcher,
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
                assets={assets as any}
                selectedAssets={selectedAssets}
                searchInput={searchInput}
                onSearchInputChange={setSearchInput}
                onSearch={handleSearch}
                onAssetSelect={handleAssetSelect}
                onSelectAllAssets={() => handleSelectAllAssets(assets as any[])}
                onBulkPostAssets={() => handleBulkPostAssets(assets as any[])}
                onBulkDeleteAssets={handleBulkDeleteAssets}
                deleteFetcherState={deleteFetcher.state}
                deleteFetcherForm={deleteFetcher.Form as any}
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
                Form: assetFetcher.Form as any,
                state: assetFetcher.state,
              }}
              uploadProvider={uploadProvider}
              bulkUploadFiles={bulkUploadFiles}
              singleFileUploading={singleFileUploading}
              bulkFileUploading={bulkFileUploading}
              onSingleFileUpload={handleSingleFileUpload}
              onBulkFileUpload={handleBulkFileUpload}
              onBulkFileChange={handleBulkFileChange}
            />
          )}

          {/* Toast Notification */}
          {showToast ? (
            <ToastNotification
              message={toastMessage}
              onClose={() => {}}
            />
          ) : null}

          {/* Template Details Modal */}
          {selectedTemplate ? (
            <TemplateDetailsModal
              template={selectedTemplate}
              onClose={() => setSelectedTemplate(null)}
            />
          ) : null}
        </div>
      ) : null}
      <Outlet />
    </>
  );
}
