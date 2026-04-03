import { logClientError } from "~/lib/error-handler.client";

import type { UploadErrorCode } from "./upload-error-codes";

export interface UploadFailureLogPayload {
  code: UploadErrorCode;
  provider?: string;
  signerType?: "nip07" | "nip46" | "none" | "unknown";
  signerConnectionHealthy?: boolean | null;
  fileName?: string;
  fileMime?: string;
  fileSize?: number;
  rawError?: string;
  localId?: string;
  uploadAttemptId?: string;
  placeholderCleaned?: boolean;
  component: string;
  action: string;
}

export function logUploadFailure(payload: UploadFailureLogPayload): void {
  const err = new Error(`upload_failure:${payload.code}`);
  logClientError(err, {
    component: payload.component,
    action: payload.action,
    uploadCode: payload.code,
    provider: payload.provider,
    signerType: payload.signerType,
    signerConnectionHealthy: payload.signerConnectionHealthy,
    fileName: payload.fileName,
    fileMime: payload.fileMime,
    fileSize: payload.fileSize,
    rawError: payload.rawError,
    localId: payload.localId,
    uploadAttemptId: payload.uploadAttemptId,
    placeholderCleaned: payload.placeholderCleaned,
  });
}
