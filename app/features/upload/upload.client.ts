// Type declaration for window.nostr is in app/types/window.d.ts

import {
  mapUnknownToUploadError,
  type UploadErrorCode,
} from "./upload-error-codes";
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

type UploadProviderName =
  | "S3"
  | "BLOSSOM_PRIMAL"
  | "BLOSSOM_BLOSSTR"
  | "BLOSSOM_SFS"
  | "BLOSSOM_CUSTOM";

export interface UploadExecutionContext {
  intentId?: string;
  provider: UploadProviderName;
  customBlossomUrl?: string | null;
  enableMirrorBlossom?: boolean;
  mirrorUploadUrls?: string[];
}

interface UploadExecutionOptions {
  context?: UploadExecutionContext;
}

/**
 * Upload a file using the user's preferred upload provider (S3 or Blossom).
 */
export async function uploadFile(
  file: File,
  options?: UploadExecutionOptions
): Promise<UploadResult> {
  return uploadFileWithOptions(file, options);
}

async function uploadFileWithOptions(
  file: File,
  options?: UploadExecutionOptions
): Promise<UploadResult> {
  try {
    const data = options?.context
      ? {
          provider: options.context.provider,
          customBlossomUrl: options.context.customBlossomUrl ?? null,
          enableMirrorBlossom: options.context.enableMirrorBlossom ?? false,
          mirrorUploadUrls: options.context.mirrorUploadUrls ?? [],
        }
      : await (async () => {
          const { getUploadProvider } = await import("~/lib/query");
          return getUploadProvider();
        })();
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
          tokenContext: options?.context?.intentId
            ? {
                intentId: options.context.intentId,
                requestedProvider: uploadProvider ?? "BLOSSOM_PRIMAL",
              }
            : undefined,
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
    const { handleAsyncError } = await import("~/lib/error-handler.client");
    handleAsyncError(
      error,
      { component: COMPONENT_UPLOAD_CLIENT, action: "uploadFile" },
      false
    );
    const mapped = mapUnknownToUploadError(error);
    return {
      success: false,
      code: mapped.code,
      error: mapped.message,
    };
  }
}

/**
 * Upload multiple files - unlimited concurrency for Blossom, parallel for S3.
 */
export async function uploadMultipleFiles(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void,
  options?: UploadExecutionOptions
): Promise<UploadResult[]> {
  const data = options?.context
    ? {
        provider: options.context.provider,
        customBlossomUrl: options.context.customBlossomUrl ?? null,
        enableMirrorBlossom: options.context.enableMirrorBlossom ?? false,
        mirrorUploadUrls: options.context.mirrorUploadUrls ?? [],
      }
    : await (async () => {
        const { getUploadProvider } = await import("~/lib/query");
        return getUploadProvider();
      })();
  const isBlossom = isBlossomProvider(data.provider);
  const provider = data.provider ?? "BLOSSOM_PRIMAL";
  const customBlossomUrl = data.customBlossomUrl ?? null;
  const providerPolicy = getProviderUploadPolicy(provider);

  if (isBlossom) {
    if (providerPolicy.lane === "authoritative_tokenized") {
      try {
        return await uploadSfsBulkFiles(
          files,
          {
            enableMirrorBlossom: data.enableMirrorBlossom ?? false,
            mirrorUploadUrls: data.mirrorUploadUrls ?? [],
          },
          onProgress,
          options?.context?.intentId
            ? {
                intentId: options.context.intentId,
                requestedProvider: provider,
              }
            : undefined
        );
      } catch (error) {
        const mapped = mapUnknownToUploadError(error);
        return files.map(() => ({
          success: false,
          code: mapped.code,
          error: mapped.message,
        }));
      }
    }

    let sharedUploader: Awaited<
      ReturnType<typeof createBlossomUploader>
    >["uploader"];
    try {
      const uploaderResult = await createBlossomUploader(
        provider,
        customBlossomUrl,
        data.enableMirrorBlossom ?? false,
        data.mirrorUploadUrls ?? []
      );
      sharedUploader = uploaderResult.uploader;
    } catch (error) {
      const mapped = mapUnknownToUploadError(error);
      return files.map(() => ({
        success: false,
        code: mapped.code,
        error: mapped.message,
      }));
    }

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
            {
              componentLabel: COMPONENT_UPLOAD_CLIENT,
              tokenContext: options?.context?.intentId
                ? {
                    intentId: options.context.intentId,
                    requestedProvider: provider,
                  }
                : undefined,
            }
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
        const result = await uploadFileWithOptions(file, options);
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
export async function uploadEditorJSImage(file: File): Promise<{
  success: number;
  file?: { url: string };
  code?: UploadErrorCode;
  error?: string;
}> {
  try {
    const { getUploadProvider } = await import("~/lib/query");
    const data = await getUploadProvider();
    const isBlossom = isBlossomProvider(data.provider);

    if (isBlossom) {
      const uploadResult = await uploadFileWithOptions(file);
      if (uploadResult.success && uploadResult.file?.url) {
        return { success: 1, file: { url: uploadResult.file.url } };
      }
      return {
        success: 0,
        code: uploadResult.code,
        error: uploadResult.error,
      };
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
    const msg = result.error?.message ?? "EditorJS upload failed";
    logClientError(new Error(msg), {
      component: COMPONENT_UPLOAD_CLIENT,
      action: "uploadEditorJSImage",
    });
    const mapped = mapUnknownToUploadError(msg, {
      httpStatus: response.status,
    });
    return { success: 0, code: mapped.code, error: mapped.message };
  } catch (error) {
    const { handleAsyncError } = await import("~/lib/error-handler.client");
    handleAsyncError(
      error,
      { component: COMPONENT_UPLOAD_CLIENT, action: "uploadEditorJSImage" },
      false
    );
    const mapped = mapUnknownToUploadError(error);
    return { success: 0, code: mapped.code, error: mapped.message };
  }
}

export const __uploadClientTestUtils = {
  runAdaptiveUploadQueue,
  decideSfsRetry,
};
