import { useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";

import { resizeImage } from "~/features/upload/image-resize";
interface UseCoverImageUploadOptions {
  uploadProvider: string | null;
  initialImage?: string;
  /** When true and provider is Blossom, file upload handler no-ops (use UI to explain). */
  mediaUploadBlocked?: boolean;
}

interface SelectedAsset {
  assetType: string;
  fileUrl?: string;
}

export function useCoverImageUpload({
  uploadProvider,
  initialImage = "",
  mediaUploadBlocked = false,
}: UseCoverImageUploadOptions) {
  const uploadFetcher = useFetcher<{
    success?: boolean;
    imageUrl?: string;
    error?: string;
  }>();
  const [image, setImage] = useState(initialImage);
  const [uploadError, setUploadError] = useState("");

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.type.startsWith("image/")) {
        setUploadError("Please select an image file");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        setUploadError("Image size must be less than 5MB");
        return;
      }

      setUploadError("");

      try {
        // Process the image to remove all metadata for privacy
        const processedFile = await resizeImage(file);

        if (uploadProvider?.includes("BLOSSOM") && mediaUploadBlocked) {
          setUploadError(
            "Connect a NIP-07 extension or NIP-46 remote signer in Settings to upload cover images."
          );
          return;
        }

        // Check if user has Blossom provider selected
        if (uploadProvider?.includes("BLOSSOM")) {
          // Use client-side upload for Blossom
          const { upload } = await import("~/features/upload/media.client");
          const uploadResult = await upload(processedFile);

          if (uploadResult.success && uploadResult.file) {
            setImage(uploadResult.file.url);
            setUploadError("");
          } else {
            setUploadError(uploadResult.error ?? "Upload failed");
          }
        } else {
          // Use server-side upload for S3
          const formData = new FormData();
          formData.append("imageFile", processedFile);
          formData.append("_action", "upload-image");

          uploadFetcher.submit(formData, {
            method: "post",
            encType: "multipart/form-data",
          });
        }
      } catch (error) {
        const { handleAsyncErrorWithMessage } =
          await import("~/lib/error-handler.client");
        handleAsyncErrorWithMessage(
          error,
          "Error uploading image. Please try again.",
          {
            component: "useCoverImageUpload",
            action: "handleImageUpload",
          },
          false // Don't show toast, we set uploadError instead
        );
        setUploadError("Error uploading image. Please try again.");
      }
    },
    [uploadProvider, uploadFetcher, mediaUploadBlocked]
  );

  const handleCoverImageAssets = useCallback(
    (selectedAssets: SelectedAsset[]) => {
      // For cover image, only use the first selected image asset
      const imageAsset = selectedAssets.find(
        (asset) => asset.assetType === "IMAGE"
      );
      const firstImageAsset = imageAsset;
      if (firstImageAsset?.fileUrl) {
        setImage(firstImageAsset.fileUrl);
        setUploadError("");
      }
    },
    []
  );

  // Handle upload fetcher responses
  const handleFetcherData = useCallback(() => {
    if (uploadFetcher.data) {
      if (uploadFetcher.data.success && uploadFetcher.data.imageUrl) {
        setImage(uploadFetcher.data.imageUrl);
        setUploadError("");
      } else if (uploadFetcher.data.error) {
        setUploadError(uploadFetcher.data.error);
      }
    }
  }, [uploadFetcher.data]);

  // Clear upload errors when fetcher state changes
  const handleFetcherStateChange = useCallback(() => {
    if (uploadFetcher.state === "submitting") {
      setUploadError("");
    }
  }, [uploadFetcher.state]);

  return {
    image,
    setImage,
    uploadError,
    uploadFetcherState: uploadFetcher.state,
    handleImageUpload,
    handleCoverImageAssets,
    handleFetcherData,
    handleFetcherStateChange,
  };
}
