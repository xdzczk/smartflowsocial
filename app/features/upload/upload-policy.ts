import { ValidationError } from "~/lib/errors";

export type UploadContext =
  | "general_media_upload"
  | "editorjs_image_upload"
  | "blossom_direct_upload"
  | "bulk_media_upload"
  | "blossom_tokenized_bulk_upload";

export interface UploadPolicy {
  allowedMimeTypes: readonly string[];
  maxFileBytes: number;
  allowMultipartBody: boolean;
  allowRemoteUrl: boolean;
  requireRemoteUrl?: boolean;
}

export type UploadPolicyErrorCode =
  | "payload_too_large"
  | "unsupported_mime_type"
  | "remote_url_required"
  | "multipart_not_allowed";

export interface UploadPolicyError {
  code: UploadPolicyErrorCode;
  message: string;
  context?: Record<string, unknown>;
}

const MB = 1024 * 1024;

export const CANONICAL_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
] as const;

export const UPLOAD_POLICIES: Record<UploadContext, UploadPolicy> = {
  general_media_upload: {
    allowedMimeTypes: CANONICAL_ALLOWED_MIME_TYPES,
    maxFileBytes: 100 * MB,
    allowMultipartBody: true,
    allowRemoteUrl: false,
  },
  editorjs_image_upload: {
    allowedMimeTypes: CANONICAL_ALLOWED_MIME_TYPES.filter((t) =>
      t.startsWith("image/")
    ),
    // Canonical decision: 10MB end-to-end for EditorJS image upload.
    maxFileBytes: 10 * MB,
    allowMultipartBody: true,
    allowRemoteUrl: true,
  },
  blossom_direct_upload: {
    allowedMimeTypes: CANONICAL_ALLOWED_MIME_TYPES,
    maxFileBytes: 0, // not used when remote url is required
    allowMultipartBody: false,
    allowRemoteUrl: true,
    requireRemoteUrl: true,
  },
  bulk_media_upload: {
    allowedMimeTypes: CANONICAL_ALLOWED_MIME_TYPES,
    maxFileBytes: 100 * MB,
    allowMultipartBody: true,
    allowRemoteUrl: true,
  },
  blossom_tokenized_bulk_upload: {
    allowedMimeTypes: CANONICAL_ALLOWED_MIME_TYPES,
    maxFileBytes: 1024 * MB,
    allowMultipartBody: false,
    allowRemoteUrl: false,
  },
};

export function getUploadPolicy(context: UploadContext): UploadPolicy {
  return UPLOAD_POLICIES[context];
}

export function validateAgainstUploadPolicy(args: {
  context: UploadContext;
  mimeType?: string | null;
  bytes?: number | null;
  hasMultipartBody: boolean;
  hasRemoteUrl: boolean;
}): UploadPolicyError | null {
  const policy = getUploadPolicy(args.context);

  if (args.hasMultipartBody && !policy.allowMultipartBody) {
    return {
      code: "multipart_not_allowed",
      message: "This upload flow does not accept multipart file bodies.",
      context: { context: args.context },
    };
  }

  if (policy.requireRemoteUrl && !args.hasRemoteUrl) {
    return {
      code: "remote_url_required",
      message: "This upload flow requires a remote image URL.",
      context: { context: args.context },
    };
  }

  const mimeType = (args.mimeType ?? "").trim().toLowerCase();
  if (mimeType && policy.allowedMimeTypes.length > 0) {
    if (!policy.allowedMimeTypes.includes(mimeType)) {
      return {
        code: "unsupported_mime_type",
        message: "This file type is not supported here.",
        context: { context: args.context, mimeType },
      };
    }
  }

  const bytes = args.bytes ?? null;
  if (typeof bytes === "number" && Number.isFinite(bytes) && bytes > 0) {
    if (policy.maxFileBytes > 0 && bytes > policy.maxFileBytes) {
      const mb = Math.round((policy.maxFileBytes / MB) * 10) / 10;
      return {
        code: "payload_too_large",
        message: `Image must be ${mb}MB or smaller.`,
        context: {
          context: args.context,
          bytes,
          maxBytes: policy.maxFileBytes,
        },
      };
    }
  }

  return null;
}

export function assertUploadPolicy(
  args: Parameters<typeof validateAgainstUploadPolicy>[0]
): void {
  const err = validateAgainstUploadPolicy(args);
  if (!err) return;
  throw new ValidationError(err.message, { code: err.code, ...err.context });
}
