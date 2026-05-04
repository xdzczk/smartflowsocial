import type { ComposerAttachment } from "~/features/posts/types";
import {
  UploadErrorCodes,
  defaultMessageForUploadError,
} from "~/features/upload/upload-error-codes";

export function collectFailedComposerAttachments(args: {
  isThreadMode: boolean;
  attachments: ComposerAttachment[];
  threadSegments: Array<{ attachments: ComposerAttachment[] }>;
}): ComposerAttachment[] {
  if (args.isThreadMode) {
    const out: ComposerAttachment[] = [];
    for (const s of args.threadSegments) {
      for (const a of s.attachments) {
        if (a.status === "failed") out.push(a);
      }
    }
    return out;
  }
  return args.attachments.filter((a) => a.status === "failed");
}

/** Deferrable rail line when `canSubmit` is false due to media. */
export function unifiedComposerMediaDeferrableMessage(args: {
  isThreadMode: boolean;
  attachments: ComposerAttachment[];
  threadSegments: Array<{ attachments: ComposerAttachment[] }>;
  isTemplateMode: boolean;
}): string {
  const failed = collectFailedComposerAttachments(args);
  const first = failed[0];
  if (!first) {
    return args.isTemplateMode
      ? "Resolve media upload issues before saving the template."
      : "Resolve media upload issues before publishing";
  }
  const code = first.uploadErrorCode;
  const hint =
    first.uploadErrorMessage ??
    (code ? defaultMessageForUploadError(code) : "Upload failed.");

  if (code?.startsWith("SIGNER_")) {
    return args.isTemplateMode
      ? `Media upload blocked  -  ${hint} Fix signer before saving the template.`
      : `Media upload blocked  -  ${hint}`;
  }
  if (code === UploadErrorCodes.UPLOAD_FILE_TOO_LARGE) {
    return `File too large  -  ${hint}`;
  }
  if (code === UploadErrorCodes.UPLOAD_UNSUPPORTED_TYPE) {
    return `Unsupported file type  -  ${hint}`;
  }
  if (
    code === UploadErrorCodes.UPLOAD_PROVIDER_UNAVAILABLE ||
    code === UploadErrorCodes.UPLOAD_NETWORK_ERROR
  ) {
    return `Upload failed  -  ${hint}`;
  }
  return args.isTemplateMode
    ? `Cannot save template yet  -  ${hint}`
    : `Cannot publish yet  -  ${hint}`;
}
