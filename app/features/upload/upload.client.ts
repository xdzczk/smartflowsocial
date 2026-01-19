// Type declaration for window.nostr is in app/types/window.d.ts

const COMPONENT_UPLOAD_CLIENT = "upload.client";

/**
 * Development-only logging helper
 */
function devLog(..._args: unknown[]): void {}

/**
 * Development-only warning helper
 */
function devWarn(..._args: unknown[]): void {}

interface UploadResult {
  success: boolean;
  file?: {
    url: string;
    size: number;
    name: string;
    extension: string;
    sha256?: string;
    mimeType?: string;
    provider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR";
  };
  error?: string;
}

/**
 * Upload a file using the user's preferred upload provider (S3 or Blossom)
 * This function handles client-side uploads and server-side processing
 */
export async function uploadFile(file: File): Promise<UploadResult> {
  try {
    // First, check what upload provider the user prefers
    // Use utility function that can work outside React components
    const { getUploadProvider } = await import("~/lib/query");
    const data = await getUploadProvider();
    const uploadProvider = data.provider;
    const enableMirrorBlossom = data.enableMirrorBlossom;
    const mirrorUploadUrls = data.mirrorUploadUrls;

    if (
      uploadProvider === "BLOSSOM_PRIMAL" ||
      uploadProvider === "BLOSSOM_BLOSSTR" ||
      uploadProvider === "BLOSSOM"
    ) {
      return await uploadFileToBlossom(
        file,
        uploadProvider,
        enableMirrorBlossom,
        mirrorUploadUrls
      );
    } else {
      return await uploadFileToS3(file);
    }
  } catch (error) {
    const { handleAsyncError, getErrorMessage } =
      await import("~/lib/error-handler.client");
    handleAsyncError(
      error,
      {
        component: COMPONENT_UPLOAD_CLIENT,
        action: "uploadFile",
      },
      false
    ); // Don't show toast, return error instead
    return {
      success: false,
      error: getErrorMessage(error) || "Upload failed",
    };
  }
}

/**
 * Upload file to S3 via server-side processing
 */
async function uploadFileToS3(file: File): Promise<UploadResult> {
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
    error?: string;
  };

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
  } else {
    return {
      success: false,
      error: result.error ?? "S3 upload failed",
    };
  }
}

/**
 * Test network connectivity to Blossom server
 */
async function testBlossomNetworkLatency(
  serverUrl: string
): Promise<number | null> {
  try {
    const testStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    await fetch(serverUrl, {
      method: "HEAD",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - testStart;
    devLog(
      `[Blossom Network] Connectivity test to ${serverUrl} took ${latency}ms`
    );
    return latency;
  } catch (error) {
    devWarn(
      `[Blossom Network] Connectivity test to ${serverUrl} failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return null;
  }
}

interface BlossomUploaderInstance {
  upload: (file: File) => Promise<string[][]>;
}

/**
 * Create a Blossom uploader instance (can be reused for multiple files)
 */
async function createBlossomUploader(
  provider: string,
  enableMirrorBlossom: boolean,
  mirrorUploadUrls: string[]
): Promise<{
  uploader: BlossomUploaderInstance;
  primaryServerUrl: string;
  servers: string[];
}> {
  // Resolve active signer (NIP-07 or NIP-46) for Blossom auth
  // @ts-ignore - Dynamic imports work in client-side Remix bundles
  const { getWindowNostrLikeSigner } =
    await import("~/lib/nostr-signer-manager.client");
  const signer = await getWindowNostrLikeSigner();
  if (!signer) {
    throw new Error(
      "Nostr signer not available. Please connect a Nostr signer (NIP-07 extension or NIP-46 remote signer)."
    );
  }

  // Dynamic import to avoid SSR issues
  const importStart = Date.now();
  const uploadersModule = await import("@nostrify/nostrify/uploaders");
  const importTime = Date.now() - importStart;
  devLog(`[Blossom Upload] Module import took ${importTime}ms`);

  const BlossomUploader =
    (
      uploadersModule as {
        BlossomUploader?: new (...args: unknown[]) => {
          upload: (file: File) => Promise<string[][]>;
        };
      }
    ).BlossomUploader ??
    (
      uploadersModule.default as {
        BlossomUploader?: new (...args: unknown[]) => {
          upload: (file: File) => Promise<string[][]>;
        };
      }
    ).BlossomUploader;
  if (!BlossomUploader) {
    throw new Error("BlossomUploader not found in module");
  }

  // Determine primary server based on provider
  let primaryServerUrl: string;
  if (provider === "BLOSSOM_BLOSSTR") {
    primaryServerUrl = "https://blosstr.com";
  } else {
    // Default to Primal for BLOSSOM_PRIMAL or legacy BLOSSOM
    primaryServerUrl = "https://blossom.primal.net";
  }

  // Test network latency to primary server
  const networkLatency = await testBlossomNetworkLatency(primaryServerUrl);
  if (networkLatency !== null) {
    devLog(
      `[Blossom Network] Primary server ${primaryServerUrl} latency: ${networkLatency}ms`
    );
  }

  // Build servers array starting with primary server
  const servers = [primaryServerUrl];

  // Add mirror URLs if enabled and available
  if (
    enableMirrorBlossom &&
    Array.isArray(mirrorUploadUrls) &&
    mirrorUploadUrls.length > 0
  ) {
    servers.push(...mirrorUploadUrls);
    // Test latency to mirror servers as well
    for (const mirrorUrl of mirrorUploadUrls) {
      const mirrorLatency = await testBlossomNetworkLatency(mirrorUrl);
      if (mirrorLatency !== null) {
        devLog(
          `[Blossom Network] Mirror server ${mirrorUrl} latency: ${mirrorLatency}ms`
        );
      }
    }
  }

  // Create uploader with NOSTR signer and all servers
  const uploader = new BlossomUploader({
    servers: servers,
    signer,
  });

  return { uploader, primaryServerUrl, servers };
}

/**
 * Upload file to Blossom via client-side processing
 */
async function uploadFileToBlossom(
  file: File,
  provider = "BLOSSOM_PRIMAL",
  enableMirrorBlossom = false,
  mirrorUploadUrls: string[] = [],
  uploader?: BlossomUploaderInstance
): Promise<UploadResult> {
  const fileUploadStart = Date.now();
  try {
    // Use provided uploader or create a new one
    let uploaderInstance: BlossomUploaderInstance;
    if (uploader) {
      uploaderInstance = uploader;
    } else {
      // Create a new uploader for single file uploads
      const uploaderResult = await createBlossomUploader(
        provider,
        enableMirrorBlossom,
        mirrorUploadUrls
      );
      uploaderInstance = uploaderResult.uploader;
    }

    // Upload the file
    const blossomUploadStart = Date.now();
    const tags = await uploaderInstance.upload(file);
    const blossomUploadTime = Date.now() - blossomUploadStart;
    devLog(
      `[Blossom Upload] File ${file.name} (${(file.size / 1024).toFixed(1)}KB) uploaded to Blossom in ${blossomUploadTime}ms`
    );

    // Validate that we got the expected tag format
    if (!Array.isArray(tags)) {
      throw new Error(
        "BlossomUploader returned invalid format - expected array of tags"
      );
    }

    // Send the result to server for processing
    const serverCallStart = Date.now();
    const response = await fetch("/api/upload-blossom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tags,
        fileName: file.name,
      }),
    });
    const serverCallTime = Date.now() - serverCallStart;
    devLog(
      `[Blossom Upload] Server processing for ${file.name} took ${serverCallTime}ms`
    );

    const result = (await response.json()) as {
      success?: boolean;
      file?: { url: string };
      error?: string;
      data?: { file?: { url: string } };
    };

    // Server returns { success: true, data: { file: {...} } }
    const fileData = result.data?.file ?? result.file;
    const totalTime = Date.now() - fileUploadStart;
    if (result.success && fileData) {
      devLog(
        `[Blossom Upload] File ${file.name} completed successfully in ${totalTime}ms total (Blossom: ${blossomUploadTime}ms, Server: ${serverCallTime}ms)`
      );
      return {
        success: true,
        file: {
          url: fileData.url,
          size: file.size,
          name: file.name,
          extension: file.name.split(".").pop() ?? "",
          provider: "BLOSSOM_PRIMAL" as const,
        },
      };
    } else {
      devLog(`[Blossom Upload] File ${file.name} failed after ${totalTime}ms`);
      return {
        success: false,
        error: result.error ?? "Blossom upload failed",
      };
    }
  } catch (error) {
    const totalTime = Date.now() - fileUploadStart;
    devLog(`[Blossom Upload] File ${file.name} errored after ${totalTime}ms`);
    const { handleAsyncError, getErrorMessage } =
      await import("~/lib/error-handler.client");
    handleAsyncError(
      error,
      {
        component: COMPONENT_UPLOAD_CLIENT,
        action: "uploadFileToBlossom",
        provider,
      },
      false
    ); // Don't show toast, return error instead
    return {
      success: false,
      error: getErrorMessage(error) || "Blossom upload failed",
    };
  }
}

/**
 * Upload multiple files - unlimited concurrency for Blossom, parallel for S3
 */
export async function uploadMultipleFiles(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<UploadResult[]> {
  // Check upload provider first
  const { getUploadProvider } = await import("~/lib/query");
  const data = await getUploadProvider();
  const isBlossom =
    data.provider === "BLOSSOM_PRIMAL" ||
    data.provider === "BLOSSOM_BLOSSTR" ||
    data.provider === "BLOSSOM";

  if (isBlossom) {
    // Blossom: Upload all files concurrently with shared uploader instance
    // Each upload takes 18-19s independently, so parallelizing all of them
    // will give us the best performance (total time ≈ slowest file)
    devLog(
      `[BulkPosts] Starting concurrent upload of ${files.length} files to Blossom`
    );

    // Create a single uploader instance to reuse for all files
    // This avoids recreating the uploader and re-testing network latency for each file
    const provider = data.provider ?? "BLOSSOM_PRIMAL";
    const uploaderResult = await createBlossomUploader(
      provider,
      data.enableMirrorBlossom ?? false,
      data.mirrorUploadUrls ?? []
    );
    const sharedUploader = uploaderResult.uploader;

    // Upload all files in parallel using the shared uploader
    const results: UploadResult[] = new Array<UploadResult>(files.length);
    let completed = 0;

    // Show initial progress
    onProgress?.(
      0,
      files.length,
      `Starting upload of ${files.length} files...`
    );

    const uploadPromises = files.map(async (file, index) => {
      const uploadStart = Date.now();

      // Use the shared uploader instance
      const result = await uploadFileToBlossom(
        file,
        provider,
        data.enableMirrorBlossom ?? false,
        data.mirrorUploadUrls ?? [],
        sharedUploader
      );

      const uploadTime = Date.now() - uploadStart;
      results[index] = result;

      // Update progress when file completes (not when it starts)
      completed++;
      const percentage = Math.round((completed / files.length) * 100);
      onProgress?.(
        completed,
        files.length,
        `Uploading... ${completed} of ${files.length} files completed (${percentage}%)`
      );

      devLog(
        `[BulkPosts] File ${completed}/${files.length} (${file.name}) uploaded in ${uploadTime}ms`
      );
      return result;
    });

    await Promise.all(uploadPromises);

    devLog(
      `[BulkPosts] All ${files.length} files uploaded concurrently to Blossom`
    );

    return results;
  }

  // S3 can handle parallel uploads with higher concurrency
  const results: UploadResult[] = new Array<UploadResult>(files.length);
  let index = 0;
  let completed = 0;

  // Show initial progress
  onProgress?.(0, files.length, `Starting upload of ${files.length} files...`);

  async function worker(): Promise<void> {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];
      if (file) {
        const uploadStart = Date.now();
        const result = await uploadFile(file);
        const uploadTime = Date.now() - uploadStart;
        results[currentIndex] = result;
        completed++;
        const percentage = Math.round((completed / files.length) * 100);
        onProgress?.(
          completed,
          files.length,
          `Uploading... ${completed} of ${files.length} files completed (${percentage}%)`
        );
        devLog(
          `[BulkPosts] File ${completed}/${files.length} (${file.name}) uploaded in ${uploadTime}ms`
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
 * Upload file for EditorJS image tool compatibility
 * This specifically uses the EditorJS endpoint which handles image processing
 */
export async function uploadEditorJSImage(
  file: File
): Promise<{ success: number; file?: { url: string } }> {
  try {
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
      return {
        success: 1,
        file: {
          url: result.file.url,
        },
      };
    } else {
      const { logClientError } = await import("~/lib/error-handler.client");
      logClientError(
        new Error(result.error?.message ?? "EditorJS upload failed"),
        {
          component: COMPONENT_UPLOAD_CLIENT,
          action: "uploadEditorJSImage",
        },
        "warning"
      );
      return {
        success: 0,
        // EditorJS expects no error property in success response
      };
    }
  } catch (error) {
    const { handleAsyncError } = await import("~/lib/error-handler.client");
    handleAsyncError(
      error,
      {
        component: COMPONENT_UPLOAD_CLIENT,
        action: "uploadEditorJSImage",
      },
      false
    ); // Don't show toast, return error code instead
    return {
      success: 0,
    };
  }
}
