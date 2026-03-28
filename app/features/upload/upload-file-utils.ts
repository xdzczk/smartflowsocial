/**
 * Pure utilities: file validation, hashing, and chunking.
 */

/** Map common extensions to MIME when `File.type` is empty (e.g. iOS Safari). */
const EXTENSION_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  webm: "video/webm",
  ogg: "video/ogg",
  ogv: "video/ogg",
  mov: "video/quicktime",
  qt: "video/quicktime",
};

/** Infer image/video MIME from filename when the browser leaves `File.type` blank. */
export function inferMimeTypeFromFileName(fileName: string): string {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  return EXTENSION_TO_MIME[ext] ?? "";
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate file type against allowed MIME types or extensions.
 * Pass empty arrays to skip that check.
 */
export function validateFileType(
  file: File,
  options: {
    allowedMimeTypes?: string[];
    allowedExtensions?: string[];
    blockMimeTypes?: string[];
  } = {}
): ValidationResult {
  const {
    allowedMimeTypes = [],
    allowedExtensions = [],
    blockMimeTypes = [],
  } = options;

  if (blockMimeTypes.length > 0 && file.type) {
    const lower = file.type.toLowerCase();
    if (blockMimeTypes.some((m) => m.toLowerCase() === lower)) {
      return { valid: false, error: `File type not allowed: ${file.type}` };
    }
  }

  if (allowedMimeTypes.length > 0) {
    const lower = file.type.toLowerCase();
    const allowed = allowedMimeTypes.map((m) => m.toLowerCase());
    if (!allowed.includes(lower)) {
      return { valid: false, error: `File type not allowed: ${file.type}` };
    }
  }

  if (allowedExtensions.length > 0) {
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    const allowed = allowedExtensions.map((e) =>
      e.toLowerCase().replace(/^\./, "")
    );
    if (!allowed.includes(ext)) {
      return { valid: false, error: `File extension not allowed: ${ext}` };
    }
  }

  return { valid: true };
}

/**
 * Validate file size (max in bytes). Optional min.
 */
export function validateFileSize(
  file: File,
  options: { maxBytes?: number; minBytes?: number } = {}
): ValidationResult {
  const { maxBytes, minBytes } = options;
  if (maxBytes != null && file.size > maxBytes) {
    return {
      valid: false,
      error: `File too large: ${(file.size / 1024).toFixed(1)}KB (max ${(maxBytes / 1024).toFixed(0)}KB)`,
    };
  }
  if (minBytes != null && file.size < minBytes) {
    return {
      valid: false,
      error: `File too small (min ${minBytes} bytes)`,
    };
  }
  return { valid: true };
}

/**
 * SHA-256 hash of file contents (hex string).
 */
export async function hashFileSha256(file: File): Promise<string> {
  const data = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(digest));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Split a file into chunks of at most chunkSize bytes.
 * Returns array of Blob slices (no copy of full file in memory at once).
 */
export function getFileChunks(
  file: File,
  chunkSizeBytes: number
): Array<{ start: number; end: number; blob: Blob }> {
  if (chunkSizeBytes <= 0 || file.size === 0) {
    return [];
  }
  const chunks: Array<{ start: number; end: number; blob: Blob }> = [];
  let start = 0;
  while (start < file.size) {
    const end = Math.min(start + chunkSizeBytes, file.size);
    chunks.push({
      start,
      end,
      blob: file.slice(start, end),
    });
    start = end;
  }
  return chunks;
}
