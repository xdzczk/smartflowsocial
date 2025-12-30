import { useFetcher } from "@remix-run/react";
import { useCallback, useRef, useState } from "react";

import { resizeImage } from "~/features/upload/image-resize";
import { uploadFile, uploadMultipleFiles } from "~/features/upload/upload.client";

import type { Asset } from "./types";

interface UseAssetUploadOptions {
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

export function useAssetUpload({
    onSuccess,
    onError,
}: UseAssetUploadOptions) {
    const assetFetcher = useFetcher<{ success?: boolean; asset?: Asset; assets?: Asset[]; error?: string }>();
    const [bulkUploadFiles, setBulkUploadFiles] = useState<File[]>([]);
    const [isProcessingImages, setIsProcessingImages] = useState(false);
    const [singleFileUploading, setSingleFileUploading] = useState(false);
    const [bulkFileUploading, setBulkFileUploading] = useState(false);
    const textAssetFormRef = useRef<HTMLFormElement>(null);
    const imageAssetFormRef = useRef<HTMLFormElement>(null);

    const handleSingleFileUpload = useCallback(async (
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

            // Process file if it's an image
            const processedFile = file.type.startsWith("image/")
                ? await resizeImage(file)
                : file;

            // Upload file using new upload system
            const uploadResult = await uploadFile(processedFile);

            if (!uploadResult.success) {
                throw new Error(uploadResult.error ?? "Upload failed");
            }

            // Submit to server with upload result
            const serverFormData = new FormData();
            serverFormData.append("_action", formData.get("_action") as string);
            serverFormData.append("title", formData.get("title") as string);
            serverFormData.append("tags", formData.get("tags") as string);
            serverFormData.append("uploadResult", JSON.stringify(uploadResult));

            assetFetcher.submit(serverFormData, { method: "post" });
        } catch (error: unknown) {
            const { handleAsyncErrorWithMessage, getErrorMessage } = await import("~/lib/error-handler.client");
            const errorMessage = `Upload failed: ${getErrorMessage(error)}`;
            handleAsyncErrorWithMessage(
                error,
                errorMessage,
                {
                    component: "useAssetUpload",
                    action: "handleSingleFileUpload",
                },
                false, // Don't show toast, we call onError instead
            );
            onError(errorMessage);
        } finally {
            setSingleFileUploading(false);
        }
    }, [assetFetcher, onError]);

    const handleBulkFileUpload = useCallback(async () => {
        if (bulkUploadFiles.length === 0) return;

        setBulkFileUploading(true);

        try {
            // Upload all files using new upload system
            const uploadResults = await uploadMultipleFiles(bulkUploadFiles);

            // Check for failed uploads
            const failedUploads = uploadResults.filter((result) => !result.success);
            if (failedUploads.length > 0) {
                const errorMessages = failedUploads
                    .map((result) => result.error)
                    .join(", ");
                throw new Error(`Upload failed: ${errorMessages}`);
            }

            // Get form data for titles and tags
            const bulkForm = document.querySelector(
                "form[data-bulk-form]",
            ) as HTMLFormElement;
            if (!bulkForm) throw new Error("Bulk form not found");

            const formData = new FormData(bulkForm);
            const serverFormData = new FormData();
            serverFormData.append("_action", "bulk_create_media_assets");
            serverFormData.append("uploadResults", JSON.stringify(uploadResults));

            // Add titles and tags
            const titles = formData.getAll("titles");
            const tags = formData.getAll("tags");
            titles.forEach((title) =>
                serverFormData.append("titles", title as string),
            );
            tags.forEach((tag) => serverFormData.append("tags", tag as string));

            assetFetcher.submit(serverFormData, { method: "post" });
        } catch (error: unknown) {
            const { handleAsyncErrorWithMessage, getErrorMessage } = await import("~/lib/error-handler.client");
            const errorMessage = `Bulk upload failed: ${getErrorMessage(error)}`;
            handleAsyncErrorWithMessage(
                error,
                errorMessage,
                {
                    component: "useAssetUpload",
                    action: "handleBulkFileUpload",
                },
                false, // Don't show toast, we call onError instead
            );
            onError(errorMessage);
        } finally {
            setBulkFileUploading(false);
        }
    }, [bulkUploadFiles, assetFetcher, onError]);

    const handleBulkFileChange = useCallback(async (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        if (e.target.files) {
            const selectedFiles = Array.from(e.target.files);

            setIsProcessingImages(true);
            try {
                // Process files to remove metadata for privacy (images only)
                const processedFiles = await Promise.all(
                    selectedFiles.map(async (file) => {
                        if (file.type.startsWith("image/")) {
                            return await resizeImage(file);
                        }
                        // Videos are uploaded as-is (no processing needed for privacy)
                        return file;
                    }),
                );
                setBulkUploadFiles(processedFiles);
            } catch (error) {
                const { handleErrorSafely } = await import("~/lib/error-handler.client");
                handleErrorSafely(error, {
                    component: "useAssetUpload",
                    action: "handleBulkFileChange",
                }, () => {
                    // Fallback to original files if processing fails
                    setBulkUploadFiles(selectedFiles);
                });
            } finally {
                setIsProcessingImages(false);
            }
        }
    }, []);

    // Handle fetcher responses
    const handleFetcherResponse = useCallback(() => {
        if (assetFetcher.data?.success) {
            // Show toast message
            if (assetFetcher.data.asset) {
                onSuccess(
                    `${assetFetcher.data.asset.assetType.toLowerCase()} asset created successfully!`,
                );
            } else if (assetFetcher.data.assets) {
                onSuccess(
                    `${assetFetcher.data.assets.length} image assets uploaded successfully!`,
                );
            } else {
                onSuccess("Asset created successfully!");
            }

            // Clear forms
            if (textAssetFormRef.current) {
                textAssetFormRef.current.reset();
            }
            if (imageAssetFormRef.current) {
                imageAssetFormRef.current.reset();
            }

            // Clear bulk upload state
            setBulkUploadFiles([]);

            // Rehydrate page by reloading data
            window.location.reload();
        }
    }, [assetFetcher.data, onSuccess]);

    return {
        assetFetcher,
        bulkUploadFiles,
        isProcessingImages,
        singleFileUploading,
        bulkFileUploading,
        textAssetFormRef,
        imageAssetFormRef,
        handleSingleFileUpload,
        handleBulkFileUpload,
        handleBulkFileChange,
        handleFetcherResponse,
    };
}
