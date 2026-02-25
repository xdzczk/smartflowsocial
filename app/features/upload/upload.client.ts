// Type declaration for window.nostr is in app/types/window.d.ts

const COMPONENT_UPLOAD_CLIENT = "upload.client";
const BLOSSOM_UPLOAD_FAILED_MESSAGE = "Blossom upload failed";
const DEFAULT_BLOB_MIME_TYPE = "application/octet-stream";
const BLOSSOM_UPLOAD_RETRY_DELAYS_MS = [1000, 3000, 8000] as const;
const PRIMARY_DESKTOP_CONCURRENCY = 4;
const PRIMARY_MOBILE_CONCURRENCY = 2;
const PRIMARY_CONCURRENCY_CAP = 10;
const PRIMARY_CONCURRENCY_FLOOR = 2;
const MIRROR_CONCURRENCY_CAP = 3;

/**
 * Development-only logging helper
 */
function devLog(..._args: unknown[]): void {}

/**
 * Development-only warning helper
 */
function devWarn(..._args: unknown[]): void {}

function isBlossomProvider(provider: string | undefined): boolean {
  return (
    provider === "BLOSSOM_PRIMAL" ||
    provider === "BLOSSOM_BLOSSTR" ||
    provider === "BLOSSOM_SFS" ||
    provider === "BLOSSOM"
  );
}

interface ProviderUploadPolicy {
  provider: string;
  lane: "authoritative_tokenized" | "compat_blossom";
}

function getProviderUploadPolicy(provider: string): ProviderUploadPolicy {
  if (provider === "BLOSSOM_SFS") {
    return {
      provider,
      lane: "authoritative_tokenized",
    };
  }
  return {
    provider,
    lane: "compat_blossom",
  };
}

interface UploadResult {
  success: boolean;
  file?: {
    url: string;
    size: number;
    name: string;
    extension: string;
    sha256?: string;
    mimeType?: string;
    provider: "S3" | "BLOSSOM_PRIMAL" | "BLOSSOM_BLOSSTR" | "BLOSSOM_SFS";
    mirrors?: MirrorUploadResult[];
  };
  error?: string;
}

interface MirrorUploadResult {
  uploadUrl: string;
  success: boolean;
  url?: string;
  sha256?: string;
  size?: number;
  type?: string;
  provider?: string;
  error?: string;
}

interface SfsTokenResult {
  sha256: string;
  size: number;
  token?: string;
  expiresIn?: number;
  error?: string;
}

interface SfsBulkTokenResponse {
  uploadUrl: string;
  batchId: string;
  expiresIn: number;
  maxParallelUploadsHint?: number;
  results: SfsTokenResult[];
}

interface SfsUploadResponse {
  url: string;
  sha256: string;
  size: number;
  type: string;
  error?: string;
  retry_after?: number;
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

    if (isBlossomProvider(uploadProvider)) {
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
    error?: string | { message?: string };
  };

  // Server may return 400 "Use Blossom upload" when provider was switched but client cache was stale
  const errorMessage =
    typeof result.error === "string"
      ? result.error
      : (result.error?.message ?? "");
  if (
    (response.status === 400 || response.status === 403) &&
    (errorMessage.includes("Blossom") ||
      errorMessage.includes("upload-blossom"))
  ) {
    const { getUploadProvider, clearUploadProviderCache } =
      await import("~/lib/query");
    clearUploadProviderCache();
    const data = await getUploadProvider({ forceRefresh: true });
    const isBlossom = isBlossomProvider(data.provider);
    if (isBlossom) {
      return await uploadFileToBlossom(
        file,
        data.provider ?? "BLOSSOM_PRIMAL",
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
  } else {
    return {
      success: false,
      error: errorMessage || "S3 upload failed",
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
  mirrorUploadUrls: string[],
  options?: { overrideServers?: string[] }
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

  // Determine primary server based on provider.
  let primaryServerUrl = "https://blossom.primal.net";
  if (provider === "BLOSSOM_BLOSSTR") {
    primaryServerUrl = "https://blosstr.com";
  } else if (provider === "BLOSSOM_SFS") {
    primaryServerUrl = "https://blossom-api.smartflow.social";
  }

  const servers =
    options?.overrideServers && options.overrideServers.length > 0
      ? options.overrideServers
      : [primaryServerUrl];

  if (!options?.overrideServers) {
    // Test network latency to primary server
    const networkLatency = await testBlossomNetworkLatency(primaryServerUrl);
    if (networkLatency !== null) {
      devLog(
        `[Blossom Network] Primary server ${primaryServerUrl} latency: ${networkLatency}ms`
      );
    }

    if (
      enableMirrorBlossom &&
      Array.isArray(mirrorUploadUrls) &&
      mirrorUploadUrls.length > 0
    ) {
      servers.push(...mirrorUploadUrls);
      for (const mirrorUrl of mirrorUploadUrls) {
        const mirrorLatency = await testBlossomNetworkLatency(mirrorUrl);
        if (mirrorLatency !== null) {
          devLog(
            `[Blossom Network] Mirror server ${mirrorUrl} latency: ${mirrorLatency}ms`
          );
        }
      }
    }
  } else {
    primaryServerUrl = options.overrideServers[0] ?? primaryServerUrl;
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
  const policy = getProviderUploadPolicy(provider);
  if (policy.lane === "authoritative_tokenized") {
    return uploadFileToSfsToken(file);
  }
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
      file?: { url: string; provider?: string };
      error?: string;
      data?: { file?: { url: string; provider?: string } };
    };

    // If provider switched to S3 but stale client still attempted Blossom, refresh and retry via S3.
    const blossomErrorMessage = result.error ?? "";
    if (
      (response.status === 400 || response.status === 403) &&
      (blossomErrorMessage.includes("not enabled") ||
        blossomErrorMessage.includes("S3") ||
        blossomErrorMessage.includes("/api/upload"))
    ) {
      const { getUploadProvider, clearUploadProviderCache } =
        await import("~/lib/query");
      clearUploadProviderCache();
      const refreshedProvider = await getUploadProvider({ forceRefresh: true });
      if (!isBlossomProvider(refreshedProvider.provider)) {
        return await uploadFileToS3(file);
      }
    }

    // Server returns { success: true, data: { file: {...} } }
    const fileData = result.data?.file ?? result.file;
    const totalTime = Date.now() - fileUploadStart;
    if (result.success && fileData) {
      const blobProvider =
        fileData.provider === "BLOSSOM_SFS" ||
        fileData.provider === "BLOSSOM_BLOSSTR"
          ? fileData.provider
          : "BLOSSOM_PRIMAL";
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
          provider: blobProvider,
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
      error: getErrorMessage(error) || BLOSSOM_UPLOAD_FAILED_MESSAGE,
    };
  }
}

function normalizeSfsErrorPayload(errorPayload: unknown): {
  error?: string;
  retry_after?: number;
} {
  if (!errorPayload || typeof errorPayload !== "object") {
    return {};
  }
  const payload = errorPayload as Record<string, unknown>;
  return {
    error: typeof payload["error"] === "string" ? payload["error"] : undefined,
    retry_after:
      typeof payload["retry_after"] === "number"
        ? payload["retry_after"]
        : undefined,
  };
}

async function hashFileSha256(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function requestSfsTokens(
  files: Array<{ file: File; sha256: string }>
): Promise<SfsBulkTokenResponse> {
  const response = await fetch("/api/blossom/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      files: files.map(({ file, sha256 }) => ({
        sha256,
        size: file.size,
        type: file.type || DEFAULT_BLOB_MIME_TYPE,
        filename: file.name,
      })),
    }),
  });
  if (!response.ok) {
    const payload = normalizeSfsErrorPayload(
      await response.json().catch(() => ({}))
    );
    throw new Error(payload.error ?? `token_request_failed_${response.status}`);
  }
  return (await response.json()) as SfsBulkTokenResponse;
}

async function uploadToSfsWithToken(
  uploadUrl: string,
  file: File,
  token: string
): Promise<SfsUploadResponse> {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "X-SFS-Upload-Token": token,
      "Content-Type": file.type || DEFAULT_BLOB_MIME_TYPE,
    },
    body: file,
  });
  const payload = (await response
    .json()
    .catch(() => ({}))) as SfsUploadResponse;
  if (!response.ok) {
    const normalized = normalizeSfsErrorPayload(payload);
    throw Object.assign(new Error(normalized.error ?? "upload_failed"), {
      status: response.status,
      errorCode: normalized.error,
      retryAfter: normalized.retry_after,
    });
  }
  return payload;
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

interface QueueTask {
  index: number;
  fileName: string;
  run: () => Promise<UploadResult>;
}

interface QueueConfig {
  totalFiles: number;
  startConcurrency: number;
  minConcurrency: number;
  maxConcurrency: number;
  adaptive: boolean;
  onProgress?: (current: number, total: number, fileName: string) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

async function runAdaptiveUploadQueue(
  tasks: QueueTask[],
  config: QueueConfig
): Promise<UploadResult[]> {
  const results: UploadResult[] = new Array<UploadResult>(tasks.length);
  let completed = 0;
  const latencies: number[] = [];
  const recentErrors: string[] = [];
  let adaptiveConcurrency = clamp(
    config.startConcurrency,
    config.minConcurrency,
    config.maxConcurrency
  );

  async function processTask(task: QueueTask): Promise<void> {
    const startedAt = Date.now();
    const result = await task.run();
    results[task.index] = result;
    const latency = Date.now() - startedAt;
    latencies.push(latency);
    if (!result.success) {
      recentErrors.push(result.error ?? "upload_failed");
    }
    completed++;
    config.onProgress?.(
      completed,
      config.totalFiles,
      `Uploading... ${completed} of ${config.totalFiles} files completed`
    );

    if (config.adaptive && completed % 10 === 0) {
      const recentLatency = latencies.slice(-10);
      const sorted = [...recentLatency].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
      const errorRate =
        recentErrors.slice(-10).filter(Boolean).length /
        Math.max(1, recentLatency.length);
      const hasRateSpike = recentErrors
        .slice(-10)
        .some((e) => e.includes("rate_limited"));

      if ((errorRate < 0.02 || median < 4000) && !hasRateSpike) {
        adaptiveConcurrency = Math.min(
          config.maxConcurrency,
          adaptiveConcurrency + 1
        );
      } else if (errorRate > 0.1 || hasRateSpike) {
        adaptiveConcurrency = Math.max(
          config.minConcurrency,
          adaptiveConcurrency - 1
        );
      }
    }
  }

  await new Promise<void>((resolve) => {
    let nextTaskIndex = 0;
    let active = 0;
    function pump(): void {
      if (completed >= tasks.length) {
        if (active === 0) resolve();
        return;
      }
      const targetConcurrency = config.adaptive
        ? clamp(
            adaptiveConcurrency,
            config.minConcurrency,
            config.maxConcurrency
          )
        : config.maxConcurrency;

      while (active < targetConcurrency && nextTaskIndex < tasks.length) {
        const task = tasks[nextTaskIndex++];
        if (!task) continue;
        active++;
        void processTask(task).finally(() => {
          active--;
          pump();
        });
      }
    }
    pump();
  });

  return results;
}

function extractBlossomTag(
  tags: string[][],
  key: "url" | "x" | "ox" | "size" | "m"
): string | undefined {
  const tag = tags.find((item) => Array.isArray(item) && item[0] === key);
  return typeof tag?.[1] === "string" ? tag[1] : undefined;
}

function tagsToUploadResponse(tags: string[][]): SfsUploadResponse {
  const url = extractBlossomTag(tags, "url");
  const sha256 =
    extractBlossomTag(tags, "x") ?? extractBlossomTag(tags, "ox") ?? "";
  const sizeRaw = extractBlossomTag(tags, "size");
  const mime = extractBlossomTag(tags, "m") ?? DEFAULT_BLOB_MIME_TYPE;
  const sizeParsed = sizeRaw ? parseInt(sizeRaw, 10) : NaN;
  if (!url || !sha256 || Number.isNaN(sizeParsed)) {
    throw new Error("invalid_mirror_tags");
  }
  return { url, sha256, size: sizeParsed, type: mime };
}

async function postBlossomMetadataCallback(params: {
  fileName: string;
  tags: string[][];
  mirrors: MirrorUploadResult[];
}): Promise<void> {
  await fetch("/api/upload-blossom", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: params.fileName,
      tags: params.tags,
      mirrors: params.mirrors,
    }),
  }).catch(() => {});
}

async function uploadFileToSfsToken(file: File): Promise<UploadResult> {
  try {
    const sha256 = await hashFileSha256(file);
    const tokenResponse = await requestSfsTokens([{ file, sha256 }]);
    const tokenResult = tokenResponse.results[0];
    if (!tokenResult?.token) {
      return {
        success: false,
        error: tokenResult?.error ?? "quota_exceeded",
      };
    }
    const uploaded = await uploadToSfsWithToken(
      tokenResponse.uploadUrl,
      file,
      tokenResult.token
    );
    return {
      success: true,
      file: {
        url: uploaded.url,
        size: uploaded.size,
        name: file.name,
        extension: file.name.split(".").pop() ?? "",
        sha256: uploaded.sha256,
        mimeType: uploaded.type,
        provider: "BLOSSOM_SFS",
      },
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : BLOSSOM_UPLOAD_FAILED_MESSAGE,
    };
  }
}

interface SfsRetryDecision {
  type: "retry" | "refresh_token" | "fail";
  delayMs?: number;
  error?: string;
}

function getSfsErrorMeta(error: unknown): {
  status?: number;
  errorCode?: string;
  retryAfter?: number;
} {
  if (!error || typeof error !== "object") {
    return {};
  }
  const payload = error as {
    status?: number;
    errorCode?: string;
    retryAfter?: number;
  };
  return {
    status: payload.status,
    errorCode: payload.errorCode,
    retryAfter: payload.retryAfter,
  };
}

function decideSfsRetry(
  error: unknown,
  attempt: number,
  maxAttempts: number
): SfsRetryDecision {
  const { status, errorCode, retryAfter } = getSfsErrorMeta(error);
  if (errorCode === "sha256_mismatch") {
    return { type: "fail", error: "sha256_mismatch" };
  }
  if (
    status === 401 &&
    errorCode === "token_expired" &&
    attempt < maxAttempts
  ) {
    return { type: "refresh_token" };
  }
  if (status === 429 && attempt < maxAttempts) {
    return { type: "retry", delayMs: (retryAfter ?? 2) * 1000 };
  }
  if ((status == null || status >= 500) && attempt < maxAttempts) {
    return {
      type: "retry",
      delayMs:
        BLOSSOM_UPLOAD_RETRY_DELAYS_MS[
          Math.min(attempt - 1, BLOSSOM_UPLOAD_RETRY_DELAYS_MS.length - 1)
        ] ?? 8000,
    };
  }
  return {
    type: "fail",
    error: error instanceof Error ? error.message : "upload_failed",
  };
}

export const __uploadClientTestUtils = {
  runAdaptiveUploadQueue,
  decideSfsRetry,
};

async function uploadMirrorFile(
  file: File,
  mirrorUrl: string,
  uploader: BlossomUploaderInstance
): Promise<MirrorUploadResult> {
  let attempt = 0;
  const maxAttempts = 3;
  while (attempt < maxAttempts) {
    attempt++;
    try {
      const tags = await uploader.upload(file);
      const parsed = tagsToUploadResponse(tags);
      return {
        uploadUrl: mirrorUrl,
        success: true,
        url: parsed.url,
        sha256: parsed.sha256,
        size: parsed.size,
        type: parsed.type,
        provider: "BLOSSOM_MIRROR",
      };
    } catch (error) {
      if (attempt < maxAttempts) {
        const delay =
          BLOSSOM_UPLOAD_RETRY_DELAYS_MS[
            Math.min(attempt - 1, BLOSSOM_UPLOAD_RETRY_DELAYS_MS.length - 1)
          ] ?? 3000;
        await sleepMs(delay);
        continue;
      }
      return {
        uploadUrl: mirrorUrl,
        success: false,
        error: error instanceof Error ? error.message : "mirror_upload_failed",
      };
    }
  }
  return {
    uploadUrl: mirrorUrl,
    success: false,
    error: "mirror_upload_failed",
  };
}

async function uploadSfsBulkFiles(
  files: File[],
  options: {
    enableMirrorBlossom: boolean;
    mirrorUploadUrls: string[];
  },
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<UploadResult[]> {
  const hashing = await Promise.all(
    files.map(async (file) => ({ file, sha256: await hashFileSha256(file) }))
  );
  const tokenResponse = await requestSfsTokens(hashing);
  const uploadUrl = tokenResponse.uploadUrl;

  const tasks = hashing
    .map((item, index) => ({
      ...item,
      index,
      token: tokenResponse.results[index]?.token,
      error: tokenResponse.results[index]?.error,
    }))
    .filter((item) => Boolean(item.token ?? item.error));

  const primaryStartConcurrency =
    typeof navigator !== "undefined" &&
    /Mobi|Android/i.test(navigator.userAgent)
      ? PRIMARY_MOBILE_CONCURRENCY
      : PRIMARY_DESKTOP_CONCURRENCY;
  const primaryMaxConcurrency = Math.max(
    PRIMARY_CONCURRENCY_FLOOR,
    Math.min(tokenResponse.maxParallelUploadsHint ?? 8, PRIMARY_CONCURRENCY_CAP)
  );

  const primaryUploads = new Map<number, SfsUploadResponse>();
  const primaryTasks: QueueTask[] = tasks.map((current) => ({
    index: current.index,
    fileName: current.file.name,
    run: async () => {
      if (!current.token) {
        return {
          success: false,
          error: current.error ?? "quota_exceeded",
        };
      }

      let attempt = 0;
      let token = current.token;
      const maxAttempts = 4;
      while (attempt < maxAttempts) {
        attempt++;
        try {
          const uploaded = await uploadToSfsWithToken(
            uploadUrl,
            current.file,
            token
          );
          primaryUploads.set(current.index, uploaded);
          return {
            success: true,
            file: {
              url: uploaded.url,
              size: uploaded.size,
              name: current.file.name,
              extension: current.file.name.split(".").pop() ?? "",
              sha256: uploaded.sha256,
              mimeType: uploaded.type,
              provider: "BLOSSOM_SFS",
            },
          };
        } catch (error) {
          const decision = decideSfsRetry(error, attempt, maxAttempts);
          if (decision.type === "refresh_token") {
            const refreshed = await requestSfsTokens([
              { file: current.file, sha256: current.sha256 },
            ]);
            const refreshedToken = refreshed.results[0]?.token;
            if (!refreshedToken) {
              return {
                success: false,
                error: refreshed.results[0]?.error ?? "token_expired",
              };
            }
            token = refreshedToken;
            continue;
          }
          if (decision.type === "retry") {
            await sleepMs(decision.delayMs ?? 1000);
            continue;
          }
          return {
            success: false,
            error: decision.error ?? "upload_failed",
          };
        }
      }
      return { success: false, error: "upload_failed" };
    },
  }));

  const results = await runAdaptiveUploadQueue(primaryTasks, {
    totalFiles: files.length,
    startConcurrency: primaryStartConcurrency,
    minConcurrency: PRIMARY_CONCURRENCY_FLOOR,
    maxConcurrency: primaryMaxConcurrency,
    adaptive: true,
    onProgress,
  });

  const shouldMirror =
    options.enableMirrorBlossom &&
    Array.isArray(options.mirrorUploadUrls) &&
    options.mirrorUploadUrls.length > 0;

  const mirrorResultsByIndex = new Map<number, MirrorUploadResult[]>();
  if (shouldMirror) {
    const uniqueMirrorUrls = Array.from(new Set(options.mirrorUploadUrls));
    const mirrorUploaderEntries = await Promise.all(
      uniqueMirrorUrls.map(async (mirrorUrl) => {
        const uploaderResult = await createBlossomUploader(
          "BLOSSOM_PRIMAL",
          false,
          [],
          { overrideServers: [mirrorUrl] }
        );
        return [mirrorUrl, uploaderResult.uploader] as const;
      })
    );
    const mirrorUploaders = new Map<string, BlossomUploaderInstance>(
      mirrorUploaderEntries
    );

    const mirrorTasks: QueueTask[] = [];
    for (const [index] of primaryUploads.entries()) {
      const file = files[index];
      if (!file) continue;
      for (const mirrorUrl of uniqueMirrorUrls) {
        const uploader = mirrorUploaders.get(mirrorUrl);
        if (!uploader) continue;
        const queueIndex = mirrorTasks.length;
        mirrorTasks.push({
          index: queueIndex,
          fileName: `${file.name} -> ${mirrorUrl}`,
          run: async () => {
            const mirrorResult = await uploadMirrorFile(
              file,
              mirrorUrl,
              uploader
            );
            const existing = mirrorResultsByIndex.get(index) ?? [];
            existing.push(mirrorResult);
            mirrorResultsByIndex.set(index, existing);
            return {
              success: mirrorResult.success,
              error: mirrorResult.error,
            };
          },
        });
      }
    }

    if (mirrorTasks.length > 0) {
      await runAdaptiveUploadQueue(mirrorTasks, {
        totalFiles: mirrorTasks.length,
        startConcurrency: Math.min(2, MIRROR_CONCURRENCY_CAP),
        minConcurrency: 1,
        maxConcurrency: MIRROR_CONCURRENCY_CAP,
        adaptive: false,
      });
    }
  }

  for (const [index, primaryUpload] of primaryUploads.entries()) {
    const file = files[index];
    if (!file) continue;
    const primaryTags: string[][] = [
      ["url", primaryUpload.url],
      ["x", primaryUpload.sha256],
      ["size", String(primaryUpload.size)],
      ["m", primaryUpload.type],
    ];
    await postBlossomMetadataCallback({
      fileName: file.name,
      tags: primaryTags,
      mirrors: mirrorResultsByIndex.get(index) ?? [],
    });
  }

  for (const [index, mirrors] of mirrorResultsByIndex.entries()) {
    const result = results[index];
    if (!result?.success || !result.file) continue;
    result.file.mirrors = mirrors;
  }

  return results;
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
  const isBlossom = isBlossomProvider(data.provider);
  const provider = data.provider ?? "BLOSSOM_PRIMAL";
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
    devLog(
      `[BulkPosts] Starting adaptive upload of ${files.length} Blossom files`
    );

    // Create a single uploader instance to reuse for all files
    // This avoids recreating the uploader and re-testing network latency for each file
    const uploaderResult = await createBlossomUploader(
      provider,
      data.enableMirrorBlossom ?? false,
      data.mirrorUploadUrls ?? []
    );
    const sharedUploader = uploaderResult.uploader;

    const startConcurrency =
      typeof navigator !== "undefined" &&
      /Mobi|Android/i.test(navigator.userAgent)
        ? PRIMARY_MOBILE_CONCURRENCY
        : PRIMARY_DESKTOP_CONCURRENCY;
    const blossomTasks: QueueTask[] = files.map((file, index) => ({
      index,
      fileName: file.name,
      run: async () =>
        uploadFileToBlossom(
          file,
          provider,
          data.enableMirrorBlossom ?? false,
          data.mirrorUploadUrls ?? [],
          sharedUploader
        ),
    }));

    return runAdaptiveUploadQueue(blossomTasks, {
      totalFiles: files.length,
      startConcurrency,
      minConcurrency: PRIMARY_CONCURRENCY_FLOOR,
      maxConcurrency: 8,
      adaptive: true,
      onProgress,
    });
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
    const { getUploadProvider } = await import("~/lib/query");
    const data = await getUploadProvider();
    const isBlossom = isBlossomProvider(data.provider);

    // Blossom path: upload directly from client and return EditorJS-compatible shape.
    if (isBlossom) {
      const uploadResult = await uploadFile(file);
      if (uploadResult.success && uploadResult.file?.url) {
        return {
          success: 1,
          file: {
            url: uploadResult.file.url,
          },
        };
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
