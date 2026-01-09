import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import {
  AssetPagination,
  AssetsTab,
  UploadTab,
  type Asset as _Asset,
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
  useTemplatesData,
  handleTemplatesAction,
  loadTemplatesData,
} from "~/features/templates";
import { withCSRFProtection } from "~/lib/csrf";
import { validateLoaderResponse } from "~/lib/validation/loader-responses.server";
import { templatesLoaderDataSchema } from "~/lib/validation/schemas/loader-responses.schemas";
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

  // Validate loader response with Zod schema
  return json(validateLoaderResponse(data, templatesLoaderDataSchema));
}

export const action = withCSRFProtection(
  async ({ request }: ActionFunctionArgs) => {
    try {
      const userId = await requireUserId(request);
      const formData = await request.formData();
      const result = await handleTemplatesAction(formData, userId);

      // Type narrowing: check if result is a Response
      if (result instanceof Response) {
        return result;
      }

      // Type narrowing: check if result has error property
      if (typeof result === "object" && "error" in result && result.error) {
        return json(result, { status: 400 });
      }

      return json(result);
    } catch (error) {
      const { handleActionError } = await import("~/lib/error-handler.server");
      return handleActionError(error);
    }
  }
);

export default function Templates() {
  // Use TanStack Query for data fetching with caching
  const { assets, totalCount, totalPages, currentPage, searchTerm } =
    useTemplatesData();

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
              <AssetPagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalCount={totalCount}
                onPageChange={handlePageChange}
              />
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
