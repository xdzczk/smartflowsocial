/**
 * S3 upload provider adapter.
 */

import { isBlossomProvider } from "./upload-provider-blossom.client";
import type { UploadResultClient } from "./upload-types.client";

export type UploadS3FallbackToBlossom = () => Promise<UploadResultClient>;

export async function uploadFileToS3(
  file: File,
  options?: {
    onServerSaysUseBlossom?: (file: File) => Promise<UploadResultClient>;
  }
): Promise<UploadResultClient> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  const result = (await response.json()) as {
    success?: boolean;
    data?: { fileUrl?: string };
    fileUrl?: string;
    error?: string | { message?: string };
  };

  const errorMessage =
    typeof result.error === "string"
      ? result.error
      : (result.error?.message ?? "");

  if (
    (response.status === 400 || response.status === 403) &&
    (errorMessage.includes("Blossom") ||
      errorMessage.includes("upload-blossom"))
  ) {
    if (options?.onServerSaysUseBlossom) {
      return await options.onServerSaysUseBlossom(file);
    }
    const { getUploadProvider, clearUploadProviderCache } =
      await import("~/lib/query");
    clearUploadProviderCache();
    const data = await getUploadProvider({ forceRefresh: true });
    if (isBlossomProvider(data.provider)) {
      const { uploadFileToBlossom } =
        await import("./upload-provider-blossom.client");
      return await uploadFileToBlossom(
        file,
        data.provider ?? "BLOSSOM_PRIMAL",
        data.customBlossomUrl ?? null,
        data.enableMirrorBlossom ?? false,
        data.mirrorUploadUrls ?? []
      );
    }
  }

  const fileUrl = result.data?.fileUrl ?? result.fileUrl;
  if (result.success && fileUrl) {
    return {
      success: true,
      file: {
        url: fileUrl,
        size: file.size,
        name: file.name,
        extension: file.name.split(".").pop() ?? "",
        provider: "S3" as const,
      },
    };
  }
  return {
    success: false,
    error: errorMessage || "S3 upload failed",
  };
}
