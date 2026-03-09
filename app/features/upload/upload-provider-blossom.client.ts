/**
 * Blossom upload provider adapter.
 */

import { hashFileSha256 } from "./upload-file-utils";
import {
  runAdaptiveUploadQueue,
  decideSfsRetry,
  sleepMs,
  BLOSSOM_UPLOAD_RETRY_DELAYS_MS,
  type QueueTask,
} from "./upload-progress.client";
import type {
  UploadResultClient,
  MirrorUploadResult,
} from "./upload-types.client";

const DEFAULT_BLOB_MIME_TYPE = "application/octet-stream";
const BLOSSOM_UPLOAD_FAILED_MESSAGE = "Blossom upload failed";
const PRIMARY_DESKTOP_CONCURRENCY = 4;
const PRIMARY_MOBILE_CONCURRENCY = 2;
const PRIMARY_CONCURRENCY_CAP = 10;
const PRIMARY_CONCURRENCY_FLOOR = 2;
const MIRROR_CONCURRENCY_CAP = 3;

function devLog(..._args: unknown[]): void {}
function devWarn(..._args: unknown[]): void {}

export function isBlossomProvider(provider: string | undefined): boolean {
  return (
    provider === "BLOSSOM_PRIMAL" ||
    provider === "BLOSSOM_BLOSSTR" ||
    provider === "BLOSSOM_SFS" ||
    provider === "BLOSSOM_CUSTOM" ||
    provider === "BLOSSOM"
  );
}

export interface ProviderUploadPolicy {
  provider: string;
  lane: "authoritative_tokenized" | "compat_blossom";
}

export function getProviderUploadPolicy(
  provider: string
): ProviderUploadPolicy {
  if (provider === "BLOSSOM_SFS") {
    return { provider, lane: "authoritative_tokenized" };
  }
  return { provider, lane: "compat_blossom" };
}

export interface BlossomUploaderInstance {
  upload: (file: File) => Promise<string[][]>;
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

function normalizeSfsErrorPayload(errorPayload: unknown): {
  error?: string;
  retry_after?: number;
} {
  if (!errorPayload || typeof errorPayload !== "object") return {};
  const payload = errorPayload as Record<string, unknown>;
  return {
    error: typeof payload["error"] === "string" ? payload["error"] : undefined,
    retry_after:
      typeof payload["retry_after"] === "number"
        ? payload["retry_after"]
        : undefined,
  };
}

async function testBlossomNetworkLatency(
  serverUrl: string
): Promise<number | null> {
  try {
    const testStart = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    await fetch(serverUrl, { method: "HEAD", signal: controller.signal });
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

export async function createBlossomUploader(
  provider: string,
  customBlossomUrl: string | null,
  enableMirrorBlossom: boolean,
  mirrorUploadUrls: string[],
  options?: { overrideServers?: string[] }
): Promise<{
  uploader: BlossomUploaderInstance;
  primaryServerUrl: string;
  servers: string[];
}> {
  const { getWindowNostrLikeSigner } =
    await import("~/lib/nostr-signer-manager.client");
  const signer = await getWindowNostrLikeSigner();
  if (!signer) {
    throw new Error(
      "Nostr signer not available. Please connect a Nostr signer (NIP-07 extension or NIP-46 remote signer)."
    );
  }

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
  if (!BlossomUploader) throw new Error("BlossomUploader not found in module");

  let primaryServerUrl = "https://blossom.primal.net";
  if (provider === "BLOSSOM_BLOSSTR") primaryServerUrl = "https://blosstr.com";
  else if (provider === "BLOSSOM_SFS")
    primaryServerUrl = "https://blossom-api.smartflow.social";
  else if (provider === "BLOSSOM_CUSTOM" && customBlossomUrl)
    primaryServerUrl = customBlossomUrl;
  else if (provider === "BLOSSOM_CUSTOM") {
    throw new Error(
      "Custom Blossom provider is selected but no custom URL is configured."
    );
  }

  const servers = options?.overrideServers?.length
    ? options.overrideServers
    : [primaryServerUrl];

  if (!options?.overrideServers?.length) {
    await testBlossomNetworkLatency(primaryServerUrl);
    if (
      enableMirrorBlossom &&
      Array.isArray(mirrorUploadUrls) &&
      mirrorUploadUrls.length > 0
    ) {
      servers.push(...mirrorUploadUrls);
      for (const mirrorUrl of mirrorUploadUrls)
        await testBlossomNetworkLatency(mirrorUrl);
    }
  } else {
    primaryServerUrl = options.overrideServers[0] ?? primaryServerUrl;
  }

  const uploader = new BlossomUploader({ servers, signer });
  return { uploader, primaryServerUrl, servers };
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
  if (!url || !sha256 || Number.isNaN(sizeParsed))
    throw new Error("invalid_mirror_tags");
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

async function uploadFileToSfsToken(file: File): Promise<UploadResultClient> {
  try {
    const sha256 = await hashFileSha256(file);
    const tokenResponse = await requestSfsTokens([{ file, sha256 }]);
    const tokenResult = tokenResponse.results[0];
    if (!tokenResult?.token) {
      return { success: false, error: tokenResult?.error ?? "quota_exceeded" };
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

export type UploadBlossomFallbackToS3 = (
  file: File
) => Promise<UploadResultClient>;

export async function uploadFileToBlossom(
  file: File,
  provider = "BLOSSOM_PRIMAL",
  customBlossomUrl: string | null = null,
  enableMirrorBlossom = false,
  mirrorUploadUrls: string[] = [],
  uploader?: BlossomUploaderInstance,
  options?: {
    componentLabel?: string;
    onProviderSwitchToS3?: UploadBlossomFallbackToS3;
  }
): Promise<UploadResultClient> {
  const policy = getProviderUploadPolicy(provider);
  if (policy.lane === "authoritative_tokenized") {
    return uploadFileToSfsToken(file);
  }

  const _fileUploadStart = Date.now();
  try {
    let uploaderInstance: BlossomUploaderInstance;
    if (uploader) {
      uploaderInstance = uploader;
    } else {
      const uploaderResult = await createBlossomUploader(
        provider,
        customBlossomUrl,
        enableMirrorBlossom,
        mirrorUploadUrls
      );
      uploaderInstance = uploaderResult.uploader;
    }

    const tags = await uploaderInstance.upload(file);
    if (!Array.isArray(tags)) {
      throw new Error(
        "BlossomUploader returned invalid format - expected array of tags"
      );
    }

    const response = await fetch("/api/upload-blossom", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags, fileName: file.name }),
    });
    const result = (await response.json()) as {
      success?: boolean;
      file?: { url: string; provider?: string };
      error?: string;
      data?: { file?: { url: string; provider?: string } };
    };

    const blossomErrorMessage = result.error ?? "";
    if (
      (response.status === 400 || response.status === 403) &&
      (blossomErrorMessage.includes("not enabled") ||
        blossomErrorMessage.includes("S3") ||
        blossomErrorMessage.includes("/api/upload"))
    ) {
      if (options?.onProviderSwitchToS3) {
        return await options.onProviderSwitchToS3(file);
      }
    }

    const fileData = result.data?.file ?? result.file;
    if (result.success && fileData) {
      const blobProvider =
        fileData.provider === "BLOSSOM_SFS" ||
        fileData.provider === "BLOSSOM_BLOSSTR" ||
        fileData.provider === "BLOSSOM_CUSTOM"
          ? fileData.provider
          : "BLOSSOM_PRIMAL";
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
    }
    return {
      success: false,
      error: result.error ?? "Blossom upload failed",
    };
  } catch (error) {
    if (options?.componentLabel) {
      const { handleAsyncError, getErrorMessage } =
        await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: options.componentLabel,
          action: "uploadFileToBlossom",
          provider,
        },
        false
      );
      return {
        success: false,
        error: getErrorMessage(error) || BLOSSOM_UPLOAD_FAILED_MESSAGE,
      };
    }
    return {
      success: false,
      error:
        error instanceof Error ? error.message : BLOSSOM_UPLOAD_FAILED_MESSAGE,
    };
  }
}

export async function uploadSfsBulkFiles(
  files: File[],
  options: {
    enableMirrorBlossom: boolean;
    mirrorUploadUrls: string[];
  },
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<UploadResultClient[]> {
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
  const primaryTasks: Array<QueueTask<UploadResultClient>> = tasks.map(
    (current) => ({
      index: current.index,
      fileName: current.file.name,
      run: async () => {
        if (!current.token) {
          return { success: false, error: current.error ?? "quota_exceeded" };
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
            return { success: false, error: decision.error ?? "upload_failed" };
          }
        }
        return { success: false, error: "upload_failed" };
      },
    })
  );

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
          null,
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

    const mirrorTasks: Array<QueueTask<UploadResultClient>> = [];
    for (const [index] of primaryUploads.entries()) {
      const file = files[index];
      if (!file) continue;
      for (const mirrorUrl of uniqueMirrorUrls) {
        const uploader = mirrorUploaders.get(mirrorUrl);
        if (!uploader) continue;
        mirrorTasks.push({
          index: mirrorTasks.length,
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
            return { success: mirrorResult.success, error: mirrorResult.error };
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
