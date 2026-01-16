// Type declaration for window.nostr is in app/types/window.d.ts

const COMPONENT_UPLOAD_CLIENT = "upload.client";

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
 * Upload file to Blossom via client-side processing
 */
async function uploadFileToBlossom(
  file: File,
  provider = "BLOSSOM_PRIMAL",
  enableMirrorBlossom = false,
  mirrorUploadUrls: string[] = []
): Promise<UploadResult> {
  try {
    // Check if NOSTR is available
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:115",
        message: "Checking NOSTR availability",
        data: { hasNostr: !!window.nostr, provider },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    if (!window.nostr) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "upload.client.ts:118",
            message: "NOSTR extension not available",
            data: {},
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "E",
          }),
        }
      ).catch(() => {});
      // #endregion
      throw new Error(
        "NOSTR extension not available. Please install a NOSTR browser extension like Alby, Amber, or nos2x."
      );
    }

    // Dynamic import to avoid SSR issues
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:123",
        message: "Importing BlossomUploader module",
        data: {},
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    const uploadersModule = await import("@nostrify/nostrify/uploaders");

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
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:141",
        message: "BlossomUploader import result",
        data: {
          hasBlossomUploader: !!BlossomUploader,
          hasDefault: !!uploadersModule.default,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
    if (!BlossomUploader) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "upload.client.ts:143",
            message: "BlossomUploader not found",
            data: {},
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "E",
          }),
        }
      ).catch(() => {});
      // #endregion
      throw new Error("BlossomUploader not found in module");
    }

    // Determine primary server based on provider
    let primaryServerUrl;
    if (provider === "BLOSSOM_BLOSSTR") {
      primaryServerUrl = "https://blosstr.com";
    } else {
      // Default to Primal for BLOSSOM_PRIMAL or legacy BLOSSOM
      primaryServerUrl = "https://blossom.primal.net";
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
    }

    // Create uploader with NOSTR signer and all servers
    const uploader = new BlossomUploader({
      servers: servers,
      signer: window.nostr,
    });

    // Upload the file
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:171",
        message: "Starting BlossomUploader.upload",
        data: { fileName: file.name, fileSize: file.size, provider },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion
    const tags = await uploader.upload(file);

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:174",
        message: "BlossomUploader.upload completed",
        data: {
          tagsIsArray: Array.isArray(tags),
          tagsLength: tags?.length,
          tags: JSON.stringify(tags),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "A",
      }),
    }).catch(() => {});
    // #endregion

    // Validate that we got the expected tag format
    if (!Array.isArray(tags)) {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "upload.client.ts:178",
            message: "Tags validation failed - not an array",
            data: { tagsType: typeof tags },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "B",
          }),
        }
      ).catch(() => {});
      // #endregion
      throw new Error(
        "BlossomUploader returned invalid format - expected array of tags"
      );
    }

    // Send the result to server for processing
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:186",
        message: "Sending tags to server",
        data: { tagsCount: tags.length, fileName: file.name },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
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

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:197",
        message: "Received server response",
        data: { status: response.status, statusText: response.statusText },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "C",
      }),
    }).catch(() => {});
    // #endregion
    const result = (await response.json()) as {
      success?: boolean;
      file?: { url: string };
      error?: string;
      data?: { file?: { url: string } };
    };

    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:204",
        message: "Parsed response data",
        data: {
          success: result.success,
          hasFile: !!result.file,
          hasDataFile: !!result.data?.file,
          resultKeys: Object.keys(result),
          fullResult: JSON.stringify(result),
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "D",
      }),
    }).catch(() => {});
    // #endregion

    if (result.success && result.file) {
      return {
        success: true,
        file: {
          url: result.file.url,
          size: file.size,
          name: file.name,
          extension: file.name.split(".").pop() ?? "",
          provider: "BLOSSOM_PRIMAL" as const,
        },
      };
    } else {
      // #region agent log
      fetch(
        "http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location: "upload.client.ts:214",
            message: "Response validation failed",
            data: {
              success: result.success,
              hasFile: !!result.file,
              hasDataFile: !!result.data?.file,
              error: result.error,
            },
            timestamp: Date.now(),
            sessionId: "debug-session",
            runId: "run1",
            hypothesisId: "D",
          }),
        }
      ).catch(() => {});
      // #endregion
      return {
        success: false,
        error: result.error ?? "Blossom upload failed",
      };
    }
  } catch (error) {
    // #region agent log
    fetch("http://127.0.0.1:7242/ingest/62e703ab-39e5-421d-8502-3e6f7b70e06a", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location: "upload.client.ts:222",
        message: "Exception caught in uploadFileToBlossom",
        data: {
          errorMessage: error instanceof Error ? error.message : String(error),
          errorType: error?.constructor?.name,
        },
        timestamp: Date.now(),
        sessionId: "debug-session",
        runId: "run1",
        hypothesisId: "E",
      }),
    }).catch(() => {});
    // #endregion
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
 * Upload multiple files - sequential for Blossom (signer limitation), parallel for S3
 */
export async function uploadMultipleFiles(
  files: File[]
): Promise<UploadResult[]> {
  // Check upload provider first
  const { getUploadProvider } = await import("~/lib/query");
  const data = await getUploadProvider();
  const isBlossom =
    data.provider === "BLOSSOM_PRIMAL" ||
    data.provider === "BLOSSOM_BLOSSTR" ||
    data.provider === "BLOSSOM";

  if (isBlossom) {
    // Blossom requires sequential uploads with delay due to external rate limits
    const results: UploadResult[] = [];
    for (let i = 0; i < files.length; i++) {
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 500)); // 500ms delay between uploads
      }
      results.push(await uploadFile(files[i]!));
    }
    return results;
  }

  // S3 can handle parallel uploads
  const results: UploadResult[] = new Array<UploadResult>(files.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < files.length) {
      const currentIndex = index++;
      const file = files[currentIndex];
      if (file) {
        results[currentIndex] = await uploadFile(file);
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
