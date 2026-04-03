import { getActiveSignerConfig, testConnection } from "~/features/auth/signer";
import { getUploadProvider } from "~/lib/query";
import { isVideoFile } from "~/utils/media-helpers";

import {
  MEDIA_UPLOAD_ACCEPT_MIME,
  MEDIA_UPLOAD_MAX_IMAGE_BYTES,
  MEDIA_UPLOAD_MAX_VIDEO_BYTES,
} from "./media-upload-limits";
import {
  UploadErrorCodes,
  type UploadErrorCode,
  defaultMessageForUploadError,
} from "./upload-error-codes";
import { inferMimeTypeFromFileName } from "./upload-file-utils";
import { isBlossomProvider } from "./upload-provider-blossom.client";

export interface PreflightOk {
  ok: true;
}

export interface PreflightFail {
  ok: false;
  code: UploadErrorCode;
  message: string;
}

export type PreflightResult = PreflightOk | PreflightFail;

function effectiveMime(file: File): string {
  const t = file.type.trim();
  return t || inferMimeTypeFromFileName(file.name) || "";
}

function isAcceptedMediaType(file: File): boolean {
  const mime = effectiveMime(file);
  if (MEDIA_UPLOAD_ACCEPT_MIME.test(mime)) return true;
  if (!file.type) {
    const inferred = inferMimeTypeFromFileName(file.name);
    return inferred ? MEDIA_UPLOAD_ACCEPT_MIME.test(inferred) : false;
  }
  return false;
}

/** Provider-agnostic checks before starting an upload (Blossom vs S3). */
export async function preflightMediaUpload(
  file: File,
  options?: { skipSignerProbe?: boolean }
): Promise<PreflightResult> {
  if (!isAcceptedMediaType(file)) {
    return {
      ok: false,
      code: UploadErrorCodes.UPLOAD_UNSUPPORTED_TYPE,
      message: defaultMessageForUploadError(
        UploadErrorCodes.UPLOAD_UNSUPPORTED_TYPE
      ),
    };
  }

  const isVideo = isVideoFile(file);
  const maxBytes = isVideo
    ? MEDIA_UPLOAD_MAX_VIDEO_BYTES
    : MEDIA_UPLOAD_MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return {
      ok: false,
      code: UploadErrorCodes.UPLOAD_FILE_TOO_LARGE,
      message: defaultMessageForUploadError(
        UploadErrorCodes.UPLOAD_FILE_TOO_LARGE
      ),
    };
  }

  let provider: string | undefined;
  try {
    const d = await getUploadProvider();
    provider = d.provider;
  } catch {
    return {
      ok: false,
      code: UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE,
      message: defaultMessageForUploadError(
        UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE
      ),
    };
  }

  if (!provider) {
    return {
      ok: false,
      code: UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE,
      message: defaultMessageForUploadError(
        UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE
      ),
    };
  }

  if (!isBlossomProvider(provider)) {
    return { ok: true };
  }

  const cfg = getActiveSignerConfig();
  if (!cfg && typeof window !== "undefined" && !window.nostr) {
    return {
      ok: false,
      code: UploadErrorCodes.SIGNER_NOT_READY,
      message: defaultMessageForUploadError(UploadErrorCodes.SIGNER_NOT_READY),
    };
  }

  if (options?.skipSignerProbe) {
    return { ok: true };
  }

  if (cfg?.type === "nip46") {
    const health = await testConnection(5000, {
      tryReconnectIfDisconnected: true,
    });
    if (!health.healthy) {
      const msg = health.error ?? "";
      const timeoutLike =
        msg.toLowerCase().includes("timeout") ||
        msg.toLowerCase().includes("too long");
      return {
        ok: false,
        code: timeoutLike
          ? UploadErrorCodes.SIGNER_TIMEOUT
          : UploadErrorCodes.SIGNER_NOT_READY,
        message:
          health.error ??
          defaultMessageForUploadError(UploadErrorCodes.SIGNER_NOT_READY),
      };
    }
  }

  return { ok: true };
}
