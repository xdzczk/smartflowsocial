/**
 * Upload validation utilities
 *
 * Provides MIME type validation and file size checking for secure uploads
 */

// Dynamic import for file-type since it's ESM-only and we're bundling as CommonJS
type FileTypeResult = {
  mime: string;
  ext: string;
};

let fileTypeFromBuffer: (buffer: Uint8Array | ArrayBuffer) => Promise<FileTypeResult | undefined>;

async function getFileTypeFromBuffer() {
  if (!fileTypeFromBuffer) {
    const fileType = await import("file-type");
    fileTypeFromBuffer = fileType.fileTypeFromBuffer;
  }
  return fileTypeFromBuffer;
}

/**
 * Allowed MIME types for uploads
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  // Add video if needed in the future:
  // "video/mp4",
] as const;

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload validation result
 */
export interface UploadValidationResult {
  valid: boolean;
  error?: string;
  detectedMimeType?: string;
}

/**
 * Validates file buffer against MIME type and size
 *
 * @param buffer - The file buffer to validate
 * @param filename - Original filename (for logging)
 * @param contentType - Content-Type header if provided (for comparison)
 * @returns Validation result with detected MIME type
 */
export async function validateUpload(
  buffer: Buffer,
  filename: string,
  contentType?: string,
): Promise<UploadValidationResult> {
  // Check size first (fastest check)
  if (buffer.length > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`,
    };
  }

  // Detect actual MIME type from buffer (magic number detection)
  let fileType;
  try {
    const fileTypeFn = await getFileTypeFromBuffer();
    fileType = await fileTypeFn(buffer);
  } catch (_error) {
    return {
      valid: false,
      error: "Could not detect file type",
    };
  }

  if (!fileType?.mime) {
    return {
      valid: false,
      error: "Could not detect file type from file content",
    };
  }

  const detectedMimeType = fileType.mime;

  // Validate against allowlist
  if (!ALLOWED_MIME_TYPES.includes(detectedMimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    return {
      valid: false,
      error: `File type ${detectedMimeType} is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
      detectedMimeType,
    };
  }

  // If contentType was provided, verify it matches detected type
  // This prevents MIME type spoofing
  if (contentType) {
    // Normalize content type (remove charset, etc.)
    const normalizedContentType = contentType.split(";")[0].trim().toLowerCase();
    const normalizedDetected = detectedMimeType.toLowerCase();

    if (normalizedContentType !== normalizedDetected) {
      return {
        valid: false,
        error: `Content-Type mismatch: expected ${detectedMimeType}, got ${contentType}`,
        detectedMimeType,
      };
    }
  }

  return {
    valid: true,
    detectedMimeType,
  };
}

/**
 * Gets the appropriate S3 ContentType from detected MIME type
 * Normalizes common variations (e.g., jpg -> jpeg)
 */
export function getS3ContentType(detectedMimeType: string): string {
  // Normalize common variations
  if (detectedMimeType === "image/jpg") {
    return "image/jpeg";
  }
  return detectedMimeType;
}

