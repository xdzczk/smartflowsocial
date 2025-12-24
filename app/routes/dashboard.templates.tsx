import { AssetType } from "@prisma/client";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  Link,
  useFetcher,
  Outlet,
  useLocation,
} from "@remix-run/react";
import { useState, useEffect, useRef } from "react";

import { requireUserId } from "~/features/auth/session.server";
import { requireFeatureAccess, requireAnySubscription } from "~/features/payments/subscriptions.server";
import { AssetsTab } from "~/features/assets/components/AssetsTab";
import { AssetPagination } from "~/features/assets/components/AssetPagination";
import { UploadTab } from "~/features/assets/components/UploadTab";
import { TemplateDetailsModal } from "~/features/templates/components/TemplateDetailsModal";
import { resizeImage } from "~/features/upload/image-resize";
import { uploadFile, uploadMultipleFiles } from "~/features/upload/upload.client";
import {
  getAssets,
  createAsset,
  deleteAsset,
  searchAssets,
} from "~/models/asset.server";
import { getTemplates, deleteTemplate } from "~/models/template.server";
import { getUserById } from "~/models/user.server";

export async function loader({ request }: { request: Request }) {
  const userId = await requireUserId(request);

  // Require that the user has at least a subscription record
  await requireAnySubscription(userId);
  // Check if user has access to templates feature
  await requireFeatureAccess(userId, 'templates');

  const url = new URL(request.url);
  const searchTerm = url.searchParams.get("search") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 100;

  const [templates, user, assetsData] = await Promise.all([
    getTemplates({ userId }),
    getUserById(userId),
    searchTerm
      ? searchAssets({ userId, searchTerm, page, limit })
      : getAssets({ userId, page, limit }),
  ]);

  return json({
    templates,
    user,
    assets: assetsData.assets,
    totalCount: assetsData.totalCount,
    totalPages: assetsData.totalPages,
    currentPage: assetsData.currentPage,
    searchTerm,
  });
}

export async function action({ request }: { request: Request }) {
  try {
    const userId = await requireUserId(request);

    const formData = await request.formData();
    const _action = formData.get("_action");

  if (_action === "delete") {
    const templateId = formData.get("templateId");
    await deleteTemplate({ id: templateId as string, userId });
    return json({ success: true });
  }

  if (_action === "delete_asset") {
    const assetId = formData.get("assetId");
    await deleteAsset({ id: assetId as string, userId });
    return json({ success: true });
  }

  if (_action === "create_text_asset") {
    const title = formData.get("title") as string;
    const content = formData.get("content") as string;
    const tagsString = formData.get("tags") as string;
    const tags = tagsString
      ? tagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
      : [];

    const asset = await createAsset({
      userId,
      title,
      content,
      tags,
      assetType: AssetType.TEXT,
    });

    return json({ success: true, asset });
  }

  if (
    _action === "create_image_asset" ||
    _action === "create_video_asset" ||
    _action === "create_media_asset"
  ) {
    const title = formData.get("title") as string;
    const uploadResult = JSON.parse(formData.get("uploadResult") as string);
    const tagsString = formData.get("tags") as string;
    const tags = tagsString
      ? tagsString
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
      : [];

    if (!uploadResult || !uploadResult.success || !uploadResult.file?.url) {
      return json(
        { error: "No file uploaded or upload failed" },
        { status: 400 },
      );
    }

    const fileUrl = uploadResult.file.url;

    // Determine asset type based on file URL extension or mime type
    let assetType: typeof AssetType.IMAGE | typeof AssetType.VIDEO = AssetType.IMAGE; // default
    const mimeType = uploadResult.file.mimeType || "";
    const lower = fileUrl.toLowerCase();
    const videoExtensions = [
      ".mp4",
      ".webm",
      ".ogg",
      ".mov",
      ".avi",
      ".mkv",
      ".m4v",
    ];

    if (
      mimeType.startsWith("video/") ||
      videoExtensions.some((ext) => lower.includes(ext))
    ) {
      assetType = AssetType.VIDEO;
    }

    const asset = await createAsset({
      userId,
      title,
      fileUrl,
      tags,
      assetType,
    });

    return json({ success: true, asset });
  }

  if (
    _action === "bulk_create_image_assets" ||
    _action === "bulk_create_media_assets"
  ) {
    const uploadResults = JSON.parse(formData.get("uploadResults") as string);
    const titles = formData.getAll("titles") as string[];
    const tagsInputs = formData.getAll("tags") as string[];

    if (!uploadResults || uploadResults.length === 0) {
      return json({ error: "No files uploaded" }, { status: 400 });
    }

    // Check for failed uploads
    const failedUploads = uploadResults.filter(
      (result: any) => !result.success,
    );
    if (failedUploads.length > 0) {
      return json({ error: "Some uploads failed" }, { status: 400 });
    }

    const assets = await Promise.all(
      uploadResults.map(async (uploadResult: any, index: number) => {
        const fileUrl = uploadResult.file.url;
        const mimeType = uploadResult.file.mimeType || "";

        // Determine asset type based on file URL extension or mime type
        let assetType: typeof AssetType.IMAGE | typeof AssetType.VIDEO = AssetType.IMAGE; // default
        const lower = fileUrl.toLowerCase();
        const videoExtensions = [
          ".mp4",
          ".webm",
          ".ogg",
          ".mov",
          ".avi",
          ".mkv",
          ".m4v",
        ];

        if (
          mimeType.startsWith("video/") ||
          videoExtensions.some((ext) => lower.includes(ext))
        ) {
          assetType = AssetType.VIDEO;
        }

        const title =
          titles[index] ||
          `${assetType === AssetType.VIDEO ? "Video" : "Image"} ${index + 1}`;
        const tagsString = tagsInputs[index] || "";
        const tags = tagsString
          ? tagsString
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
          : [];

        return createAsset({
          userId,
          title,
          fileUrl,
          tags,
          assetType,
        });
      }),
    );

    return json({ success: true, assets });
  }

  if (_action === "bulk_delete_assets") {
    const assetIds = formData.getAll("assetIds") as string[];

    if (assetIds.length === 0) {
      return json(
        { error: "No assets selected for deletion" },
        { status: 400 },
      );
    }

    await Promise.all(
      assetIds.map((assetId) => deleteAsset({ id: assetId, userId })),
    );

    return json({ success: true, deletedCount: assetIds.length });
  }

  if (_action === "schedule") {
    const templateId = formData.get("templateId");
    const template = await getTemplates({ userId }).then((templates) =>
      templates.find((t) => t.id === templateId),
    );

    if (!template) {
      return json({ error: "Template not found" }, { status: 404 });
    }

    // Prepare template data for scheduling (similar to repost mode)
    const localDate = new Date();
    localDate.setHours(localDate.getHours() + 1);

    const templateData = template.posts.map((post, index) => {
      const scheduleDate = new Date(localDate);
      scheduleDate.setHours(scheduleDate.getHours() + index);

      return {
        caption: post.caption || "",
        fileUrl: post.fileUrl,
        queueType: post.queueTypeId || "unassigned",
        scheduledFor: scheduleDate
          .toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })
          .replace(/(\d+)\/(\d+)\/(\d+),\s(\d+):(\d+)/, "$3-$1-$2T$4:$5"),
      };
    });

    return json({ scheduleData: templateData });
  }

    return json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    // Use centralized error handling
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

  const deleteFetcher = useFetcher();
  const scheduleFetcher = useFetcher<{ scheduleData?: any[] }>();
  const assetFetcher = useFetcher<{ success?: boolean; asset?: any; assets?: any[] }>();

  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"assets" | "upload">("assets");
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState(searchTerm || "");
  const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [uploadProvider, setUploadProvider] = useState<string | null>(null);
  const [singleFileUploading, setSingleFileUploading] = useState(false);
  const [bulkFileUploading, setBulkFileUploading] = useState(false);

  const textAssetFormRef = useRef<HTMLFormElement>(null);
  const imageAssetFormRef = useRef<HTMLFormElement>(null);
  const location = useLocation();

  // Fetch upload provider on component mount
  useEffect(() => {
    fetch("/api/user-upload-provider")
      .then((res) => res.json())
      .then((data) => setUploadProvider(data.provider))
      .catch((err) => console.error("Failed to get upload provider:", err));
  }, []);

  // Check if we're on a child route (edit page)
  const isOnChildRoute = location.pathname.includes("/edit/");

  // Handle schedule data response
  useEffect(() => {
    if (scheduleFetcher.data?.scheduleData) {
      sessionStorage.setItem(
        "repostData",
        JSON.stringify(scheduleFetcher.data.scheduleData),
      );
      window.location.href = "/dashboard/bulkposts?mode=recycle";
    }
  }, [scheduleFetcher.data]);

  // Handle successful asset creation
  useEffect(() => {
    if (assetFetcher.data?.success) {
      if (assetFetcher.data.asset) {
        setToastMessage(
          `${assetFetcher.data.asset.assetType.toLowerCase()} asset created successfully!`,
        );
      } else if (assetFetcher.data.assets) {
        setToastMessage(
          `${assetFetcher.data.assets.length} image assets uploaded successfully!`,
        );
      } else {
        setToastMessage("Asset created successfully!");
      }
      setShowToast(true);

      if (textAssetFormRef.current) {
        textAssetFormRef.current.reset();
      }
      if (imageAssetFormRef.current) {
        imageAssetFormRef.current.reset();
      }

      setBulkUploadFiles([]);
      setTimeout(() => setShowToast(false), 3000);
      window.location.reload();
    }
  }, [assetFetcher.data]);

  // Asset management handlers
  const handleAssetSelect = (assetId: string) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId],
    );
  };

  const handleSelectAllAssets = () => {
    if (selectedAssets.length === assets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(assets.map((asset: any) => asset.id));
    }
  };

  const handleBulkPostAssets = () => {
    if (selectedAssets.length === 0) return;

    const selectedAssetData = assets.filter((asset: any) =>
      selectedAssets.includes(asset.id),
    );

    const assetData = selectedAssetData.map((asset: any) => ({
      caption: asset.assetType === "TEXT" ? asset.content : asset.title || "",
      fileUrl:
        asset.assetType === "IMAGE" || asset.assetType === "VIDEO"
          ? asset.fileUrl
          : null,
      queueType: "unassigned",
      scheduledFor: new Date(Date.now() + 60 * 60 * 1000)
        .toISOString()
        .slice(0, 16),
    }));

    sessionStorage.setItem("repostData", JSON.stringify(assetData));
    window.location.href = "/dashboard/bulkposts?mode=recycle";
  };

  const handleBulkDeleteAssets = () => {
    if (selectedAssets.length === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedAssets.length} selected asset${selectedAssets.length > 1 ? "s" : ""}?`,
      )
    ) {
      return;
    }

    const formData = new FormData();
    formData.append("_action", "bulk_delete_assets");
    selectedAssets.forEach((assetId) => {
      formData.append("assetIds", assetId);
    });

    deleteFetcher.submit(formData, { method: "post" });
    setSelectedAssets([]);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const url = new URL(window.location.href);
    if (searchInput.trim()) {
      url.searchParams.set("search", searchInput.trim());
    } else {
      url.searchParams.delete("search");
    }
    url.searchParams.delete("page");
    window.location.href = url.toString();
  };

  const handlePageChange = (newPage: number) => {
    setSelectedAssets([]);
    const url = new URL(window.location.href);
    if (newPage === 1) {
      url.searchParams.delete("page");
    } else {
      url.searchParams.set("page", newPage.toString());
    }
    window.location.href = url.toString();
  };

  const handleDeleteAsset = (e: React.MouseEvent<HTMLButtonElement>, assetId: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) {
      e.preventDefault();
    }
  };

  // Upload handlers
  const handleSingleFileUpload = async (
    e: React.FormEvent,
    form: HTMLFormElement,
  ) => {
    e.preventDefault();
    setSingleFileUploading(true);

    try {
      const formData = new FormData(form);
      const fileInput = form.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = fileInput?.files?.[0];

      if (!file) {
        throw new Error("No file selected");
      }

      const processedFile = file.type.startsWith("image/")
        ? await resizeImage(file)
        : file;

      const uploadResult = await uploadFile(processedFile);

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Upload failed");
      }

      const serverFormData = new FormData();
      serverFormData.append("_action", formData.get("_action") as string);
      serverFormData.append("title", formData.get("title") as string);
      serverFormData.append("tags", formData.get("tags") as string);
      serverFormData.append("uploadResult", JSON.stringify(uploadResult));

      assetFetcher.submit(serverFormData, { method: "post" });
    } catch (error: any) {
      console.error("Upload error:", error);
      setToastMessage(`Upload failed: ${error.message || "Unknown error"}`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setSingleFileUploading(false);
    }
  };

  const handleBulkFileUpload = async () => {
    if (bulkUploadFiles.length === 0) return;

    setBulkFileUploading(true);

    try {
      const uploadResults = await uploadMultipleFiles(bulkUploadFiles);

      const failedUploads = uploadResults.filter((result) => !result.success);
      if (failedUploads.length > 0) {
        const errorMessages = failedUploads
          .map((result) => result.error)
          .join(", ");
        throw new Error(`Upload failed: ${errorMessages}`);
      }

      const bulkForm = document.querySelector(
        "form[data-bulk-form]",
      ) as HTMLFormElement;
      if (!bulkForm) throw new Error("Bulk form not found");

      const formData = new FormData(bulkForm);
      const serverFormData = new FormData();
      serverFormData.append("_action", "bulk_create_media_assets");
      serverFormData.append("uploadResults", JSON.stringify(uploadResults));

      const titles = formData.getAll("titles");
      const tags = formData.getAll("tags");
      titles.forEach((title) =>
        serverFormData.append("titles", title as string),
      );
      tags.forEach((tag) => serverFormData.append("tags", tag as string));

      assetFetcher.submit(serverFormData, { method: "post" });
    } catch (error: any) {
      console.error("Bulk upload error:", error);
      setToastMessage(
        `Bulk upload failed: ${error.message || "Unknown error"}`,
      );
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setBulkFileUploading(false);
    }
  };

  const handleBulkFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);

      try {
        const processedFiles = await Promise.all(
          selectedFiles.map(async (file) => {
            if (file.type.startsWith("image/")) {
              return await resizeImage(file);
            }
            return file;
          }),
        );
        setBulkUploadFiles(processedFiles);
      } catch (error) {
        console.error("Error processing media files:", error);
        setBulkUploadFiles(selectedFiles);
      }
    }
  };

  return (
    <>
      {/* Only show parent content when NOT on a child route */}
      {!isOnChildRoute ? (
        <div className="p-6">
          {/* Page Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Assets</h1>
              <p className="text-gray-600 dark:text-gray-400">
                Manage your reusable content assets
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("assets")}
                className={`border-b-2 px-1 pb-4 text-sm font-medium ${activeTab === "assets"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
              >
                Assets
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`border-b-2 px-1 pb-4 text-sm font-medium ${activeTab === "upload"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  }`}
              >
                Upload
              </button>
            </nav>
          </div>

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
                onSelectAllAssets={handleSelectAllAssets}
                onBulkPostAssets={handleBulkPostAssets}
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
            <div className="fixed bottom-4 right-4 rounded-lg bg-green-500 px-4 py-3 text-white shadow-lg">
              {toastMessage}
            </div>
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
