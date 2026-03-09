// Type declaration for window.nostr is in app/types/window.d.ts

import {
  runAdaptiveUploadQueue,
  decideSfsRetry,
  type QueueTask,
} from "./upload-progress.client";
import {
  isBlossomProvider,
  getProviderUploadPolicy,
  createBlossomUploader,
  uploadFileToBlossom,
  uploadSfsBulkFiles,
} from "./upload-provider-blossom.client";
import { uploadFileToS3 } from "./upload-provider-s3.client";
import type { UploadResultClient } from "./upload-types.client";

const COMPONENT_UPLOAD_CLIENT = "upload.client";

const PRIMARY_DESKTOP_CONCURRENCY = 4;
const PRIMARY_MOBILE_CONCURRENCY = 2;
const PRIMARY_CONCURRENCY_FLOOR = 2;

/** Public upload result shape (success/file/error). Alias for compatibility. */
export type UploadResult = UploadResultClient;

/**
 * Upload a file using the user's preferred upload provider (S3 or Blossom).
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  try {
    const { getUploadProvider } = await import("~/lib/query");
    const data = await getUploadProvider();
    const uploadProvider = data.provider;
    const customBlossomUrl = data.customBlossomUrl;
    const enableMirrorBlossom = data.enableMirrorBlossom;
    const mirrorUploadUrls = data.mirrorUploadUrls;

    if (isBlossomProvider(uploadProvider)) {
      return await uploadFileToBlossom(
        file,
        uploadProvider,
        customBlossomUrl,
        enableMirrorBlossom,
        mirrorUploadUrls,
        undefined,
        {
          componentLabel: COMPONENT_UPLOAD_CLIENT,
          onProviderSwitchToS3: (f) => uploadFileToS3(f),
        }
      );
    }
    return await uploadFileToS3(file, {
      onServerSaysUseBlossom: async (f) => {
        const { getUploadProvider, clearUploadProviderCache } =
          await import("~/lib/query");
        clearUploadProviderCache();
        const d = await getUploadProvider({ forceRefresh: true });
        if (!isBlossomProvider(d.provider)) return uploadFileToS3(f);
        return uploadFileToBlossom(
          f,
          d.provider ?? "BLOSSOM_PRIMAL",
          d.customBlossomUrl ?? null,
          d.enableMirrorBlossom ?? false,
          d.mirrorUploadUrls ?? []
        );
      },
    });
  } catch (error) {
    const { handleAsyncError, getErrorMessage } =
      await import("~/lib/error-handler.client");
    handleAsyncError(
      error,
      { component: COMPONENT_UPLOAD_CLIENT, action: "uploadFile" },
      false
    );
    return {
      success: false,
      error: getErrorMessage(error) || "Upload failed",
    };
  }
}

/**
 * Upload multiple files - unlimited concurrency for Blossom, parallel for S3.
 */
export async function uploadMultipleFiles(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<UploadResult[]> {
  const { getUploadProvider } = await import("~/lib/query");
  const data = await getUploadProvider();
  const isBlossom = isBlossomProvider(data.provider);
  const provider = data.provider ?? "BLOSSOM_PRIMAL";
  const customBlossomUrl = data.customBlossomUrl ?? null;
  const providerPolicy = getProviderUploadPolicy(provider);

  if (isBlossom) {
    if (providerPolicy.lane === "authoritative_tokenized") {
      return uploadSfsBulkFiles(
        files,
        {
          enableMirrorBlossom: data.enableMirrorBlossom ?? false,
          mirrorUploadUrls: data.mirrorUploadUrls ?? [],
        },
        onProgress
      );
    }

    const uploaderResult = await createBlossomUploader(
      provider,
      customBlossomUrl,
      data.enableMirrorBlossom ?? false,
      data.mirrorUploadUrls ?? []
    );
    const sharedUploader = uploaderResult.uploader;

    const startConcurrency =
      typeof navigator !== "undefined" &&
      /Mobi|Android/i.test(navigator.userAgent)
        ? PRIMARY_MOBILE_CONCURRENCY
        : PRIMARY_DESKTOP_CONCURRENCY;

    const blossomTasks: Array<QueueTask<UploadResultClient>> = files.map(
      (file, index) => ({
        index,
        fileName: file.name,
        run: () =>
          uploadFileToBlossom(
            file,
            provider,
            customBlossomUrl,
            data.enableMirrorBlossom ?? false,
            data.mirrorUploadUrls ?? [],
            sharedUploader,
            { componentLabel: COMPONENT_UPLOAD_CLIENT }
          ),
      })
    );

    return runAdaptiveUploadQueue(blossomTasks, {
      totalFiles: files.length,
      startConcurrency,
      minConcurrency: PRIMARY_CONCURRENCY_FLOOR,
      maxConcurrency: 8,
      adaptive: true,
      onProgress,
    });
  }

  const results = new Array<UploadResult>(files.length);
  let index = 0;
  let completed = 0;
  onProgress?.(0, files.length, `Starting upload of ${files.length} files...`);

  async function worker(): Promise<void> {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];
      if (file) {
        const result = await uploadFile(file);
        results[currentIndex] = result;
        completed++;
        const percentage = Math.round((completed / files.length) * 100);
        onProgress?.(
          completed,
          files.length,
          `Uploading... ${completed} of ${files.length} files completed (${percentage}%)`
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(5, files.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

/**
 * Upload file for EditorJS image tool compatibility.
 */
export async function uploadEditorJSImage(
  file: File
): Promise<{ success: number; file?: { url: string } }> {
  try {
    const { getUploadProvider } = await import("~/lib/query");
    const data = await getUploadProvider();
    const isBlossom = isBlossomProvider(data.provider);

    if (isBlossom) {
      const uploadResult = await uploadFile(file);
      if (uploadResult.success && uploadResult.file?.url) {
        return { success: 1, file: { url: uploadResult.file.url } };
      }
      return { success: 0 };
    }

    const formData = new FormData();
    formData.append("image", file);
    const response = await fetch("/api/upload-editorjs-image", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as {
      success?: number;
      file?: { url: string };
      error?: { message?: string };
    };

    if (result.success === 1 && result.file) {
      return { success: 1, file: { url: result.file.url } };
    }
    const { logClientError } = await import("~/lib/error-handler.client");
    logClientError(
      new Error(result.error?.message ?? "EditorJS upload failed"),
      { component: COMPONENT_UPLOAD_CLIENT, action: "uploadEditorJSImage" },
      "warning"
    );
    return { success: 0 };
  } catch (error) {
    const { handleAsyncError } = await import("~/lib/error-handler.client");
    handleAsyncError(
      error,
      { component: COMPONENT_UPLOAD_CLIENT, action: "uploadEditorJSImage" },
      false
    );
    return { success: 0 };
  }
}

export const __uploadClientTestUtils = {
  runAdaptiveUploadQueue,
  decideSfsRetry,
};
