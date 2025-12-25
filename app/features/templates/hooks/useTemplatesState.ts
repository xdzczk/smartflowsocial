import { useState, useEffect, useRef } from "react";
import { useFetcher, useLocation } from "@remix-run/react";
import { resizeImage } from "~/features/upload/image-resize";
import { uploadFile, uploadMultipleFiles } from "~/features/upload/upload.client";
import type { Template, ScheduleData, TemplateFetcher } from "~/features/templates/types";
import type { Asset, AssetFetcher } from "~/features/assets/types";

interface UseTemplatesStateProps {
  searchTerm: string;
}

/**
 * Custom hook for managing templates/assets state and operations
 */
export function useTemplatesState({ searchTerm }: UseTemplatesStateProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
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

  const deleteFetcher = useFetcher();
  const scheduleFetcher: TemplateFetcher = useFetcher<{ scheduleData?: ScheduleData[] }>();
  const assetFetcher: AssetFetcher = useFetcher<{ success?: boolean; asset?: Asset; assets?: Asset[] }>();

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

  const handleSelectAllAssets = (assets: Asset[]) => {
    if (selectedAssets.length === assets.length) {
      setSelectedAssets([]);
    } else {
      setSelectedAssets(assets.map((asset) => asset.id));
    }
  };

  const handleBulkPostAssets = (assets: Asset[]) => {
    if (selectedAssets.length === 0) return;

    const selectedAssetData = assets.filter((asset) =>
      selectedAssets.includes(asset.id),
    );

    const assetData = selectedAssetData.map((asset) => ({
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
    } catch (error: unknown) {
      console.error("Upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setToastMessage(`Upload failed: ${errorMessage}`);
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
    } catch (error: unknown) {
      console.error("Bulk upload error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setToastMessage(`Bulk upload failed: ${errorMessage}`);
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

  return {
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
  };
}

