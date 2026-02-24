import { Loader2 } from "lucide-react";
import { useState, useCallback, useRef } from "react";

import { Button } from "~/components/ui/button";
import { logClientError } from "~/lib/error-handler.client";
interface SmartUploadButtonProps {
  onUploadStart?: () => void;
  onUploadProgress?: (progress: number) => void;
  onUploadComplete?: (fileUrl: string, provider: string) => void;
  onUploadError?: (error: string) => void;
  accept?: string;
  multiple?: boolean;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

interface UploadProvider {
  provider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR" | "BLOSSOM_SFS";
  isUsingBlossom: boolean;
}

export function SmartUploadButton({
  onUploadStart,
  onUploadProgress,
  onUploadComplete,
  onUploadError,
  accept = "image/*",
  multiple = false,
  children = "Upload File",
  className,
  disabled = false,
}: SmartUploadButtonProps) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkUploadProvider = async (): Promise<UploadProvider> => {
    try {
      const response = await fetch("/api/user-upload-provider");
      if (!response.ok) throw new Error("Failed to check provider");
      const data = (await response.json()) as { provider?: string };

      // Handle legacy BLOSSOM value as BLOSSOM_PRIMAL
      if (data.provider === "BLOSSOM" || data.provider === "BLOSSOM_PRIMAL") {
        return { provider: "BLOSSOM_PRIMAL", isUsingBlossom: true };
      }
      if (data.provider === "BLOSSOM_BLOSSTR") {
        return { provider: "BLOSSOM_BLOSSTR", isUsingBlossom: true };
      }
      if (data.provider === "BLOSSOM_SFS") {
        return { provider: "BLOSSOM_SFS", isUsingBlossom: true };
      }
      return { provider: "S3", isUsingBlossom: false };
    } catch (error) {
      const { handleErrorSafely } = await import("~/lib/error-handler.client");
      handleErrorSafely(error, {
        component: "SmartUploadButton",
        action: "checkUploadProvider",
      });
      return { provider: "S3", isUsingBlossom: false };
    }
  };

  const uploadToS3 = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error ?? "Upload failed");
    }

    const result = (await response.json()) as { fileUrl?: string };
    if (!result.fileUrl) {
      throw new Error("Upload failed: No file URL returned");
    }
    return result.fileUrl;
  };

  const uploadToBlossom = useCallback(
    async (
      _file: File,
      _provider: "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR" | "BLOSSOM_SFS"
    ): Promise<string> => {
      try {
        // @ts-ignore - Dynamic imports work in client-side Remix bundles
        const { getWindowNostrLikeSigner } =
          await import("~/lib/nostr-signer-manager.client");
        const signer = await getWindowNostrLikeSigner();
        if (!signer) {
          throw new Error(
            "Nostr signer not found. Please connect a signer (NIP-07 extension or NIP-46 remote signer) to upload to Blossom."
          );
        }

        onUploadProgress?.(10); // Starting auth

        // Note: Blossom uploads now handled by upload.client.ts utility
        throw new Error(
          "Direct blossom uploads not supported in SmartUploadButton. Use upload.client.ts instead."
        );
      } catch (error) {
        const { handleAsyncError } = await import("~/lib/error-handler.client");
        handleAsyncError(
          error,
          {
            component: "SmartUploadButton",
            action: "uploadToBlossom",
          },
          false
        ); // Don't show toast, throw to caller
        throw error;
      }
    },
    [onUploadProgress]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      onUploadStart?.();

      try {
        onUploadProgress?.(5); // Starting

        // Check which provider the user has selected
        const providerInfo = await checkUploadProvider();

        onUploadProgress?.(10); // Provider checked

        let fileUrl: string;

        if (providerInfo.isUsingBlossom) {
          if (
            providerInfo.provider === "BLOSSOM_PRIMAL" ||
            providerInfo.provider === "BLOSSOM_BLOSSTR" ||
            providerInfo.provider === "BLOSSOM_SFS"
          ) {
            fileUrl = await uploadToBlossom(file, providerInfo.provider);
          } else {
            throw new Error("Unknown Blossom provider");
          }
        } else {
          fileUrl = await uploadToS3(file);
        }

        onUploadProgress?.(100); // Complete
        onUploadComplete?.(fileUrl, providerInfo.provider);
      } catch (error) {
        logClientError(
          error instanceof Error ? error : new Error(String(error)),
          {
            component: "SmartUploadButton",
            action: "handleFileUpload",
            message: "Upload error",
          }
        );
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";
        onUploadError?.(errorMessage);
      } finally {
        setUploading(false);
        onUploadProgress?.(0);

        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    },
    [
      onUploadStart,
      onUploadProgress,
      onUploadComplete,
      onUploadError,
      uploadToBlossom,
    ]
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      if (multiple) {
        // Handle multiple files
        Array.from(files).forEach((file) => void handleFileUpload(file));
      } else {
        // Handle single file
        const firstFile = files[0];
        if (firstFile) {
          void handleFileUpload(firstFile);
        }
      }
    },
    [handleFileUpload, multiple]
  );

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      <Button
        onClick={handleButtonClick}
        disabled={disabled || uploading}
        className={className}
      >
        {uploading ? (
          <>
            <Loader2 className="mr-3 -ml-1 h-4 w-4 animate-spin" aria-hidden />
            Uploading...
          </>
        ) : (
          children
        )}
      </Button>
    </>
  );
}

export default SmartUploadButton;
