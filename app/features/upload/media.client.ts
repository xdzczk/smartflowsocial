import {
  uploadFile as uploadFileLegacy,
  uploadMultipleFiles as uploadMultipleFilesLegacy,
} from "./upload.client";

interface LegacyUploadResult {
  success: boolean;
  file?: {
    url: string;
    size: number;
    name: string;
    extension: string;
    sha256?: string;
    mimeType?: string;
    provider:
      | "S3"
      | "BLOSSOM_PRIMAL"
      | "BLOSSOM_BLOSSTR"
      | "BLOSSOM_SFS"
      | "BLOSSOM_CUSTOM";
  };
  error?: string;
}

interface IntentResponse {
  intentId: string;
}

async function createIntent(files: File[]): Promise<IntentResponse | null> {
  try {
    const response = await fetch("/api/media/intents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: files.map((file) => ({
          fileName: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        })),
      }),
    });
    if (!response.ok) return null;
    return (await response.json()) as IntentResponse;
  } catch {
    return null;
  }
}

async function commitUploads(
  results: LegacyUploadResult[],
  originalFiles: File[]
): Promise<Array<{ resultIndex: number; finalUrl: string }>> {
  const items = results
    .map((result, index) => {
      if (!result.success || !result.file) return null;
      const file = originalFiles[index];
      if (!file) return null;
      return {
        resultIndex: index,
        fileName: file.name,
        url: result.file.url,
        size: result.file.size,
        mimeType: result.file.mimeType ?? file.type,
        provider: result.file.provider,
        sha256: result.file.sha256,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
  if (items.length === 0) return [];
  const response = await fetch("/api/media/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: items.map((item) => ({
        fileName: item.fileName,
        url: item.url,
        size: item.size,
        mimeType: item.mimeType,
        provider: item.provider,
        sha256: item.sha256,
      })),
    }),
  }).catch(() => null);
  if (!response?.ok) return [];

  const payload = (await response.json().catch(() => ({}))) as {
    committed?: Array<{ assetId: string }>;
  };
  const committed = Array.isArray(payload.committed) ? payload.committed : [];
  return committed
    .map((entry, idx) => {
      const item = items[idx];
      if (!item || !entry.assetId) return null;
      const finalUrl = item.url;
      return {
        resultIndex: item.resultIndex,
        finalUrl,
      };
    })
    .filter(
      (entry): entry is { resultIndex: number; finalUrl: string } => !!entry
    );
}

export async function upload(file: File): Promise<LegacyUploadResult> {
  await createIntent([file]);
  const result = await uploadFileLegacy(file);
  const committed = await commitUploads([result], [file]);
  const finalUrl = committed[0]?.finalUrl;
  if (finalUrl && result.success && result.file) {
    result.file.url = finalUrl;
  }
  return result;
}

export async function uploadMany(
  files: File[],
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<LegacyUploadResult[]> {
  await createIntent(files);
  const results = await uploadMultipleFilesLegacy(files, onProgress);
  const committed = await commitUploads(results, files);
  for (const entry of committed) {
    const result = results[entry.resultIndex];
    if (result?.success && result.file) {
      result.file.url = entry.finalUrl;
    }
  }
  return results;
}
