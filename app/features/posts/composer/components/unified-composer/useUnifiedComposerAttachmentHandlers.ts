import { useCallback, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import { getActiveSignerConfig } from "~/features/auth/signer";
import { uploadMany as uploadMultipleFiles } from "~/features/upload/media.client";
import {
  defaultMessageForUploadError,
  inferUploadErrorCodeFromMessage,
  mapUnknownToUploadError,
  type UploadErrorCode,
} from "~/features/upload/upload-error-codes";
import { logUploadFailure } from "~/features/upload/upload-failure-log.client";
import { preflightMediaUpload } from "~/features/upload/upload-preflight.client";
import { getUploadProvider } from "~/lib/query";

import type { ComposerAttachment } from "../../../types";
import {
  appendToken,
  getTokenLocalIds,
  removeToken,
  reorderAttachmentTokensInContent,
} from "../../../utils/inline-tokens.client";
import type { TextPostFormData } from "../../hooks/composer-submit-types";
import {
  composerAttachmentMime,
  filterMediaFiles,
} from "../composer/composer-helpers";

type TextPostForm = UseFormReturn<TextPostFormData>;

function signerTypeForLog(): "nip07" | "nip46" | "none" {
  const c = getActiveSignerConfig();
  if (c?.type === "nip46") return "nip46";
  if (c?.type === "nip07") return "nip07";
  if (typeof window !== "undefined" && window.nostr) return "nip07";
  return "none";
}

function logAttachmentUploadFailure(args: {
  code: UploadErrorCode;
  message: string;
  file: File;
  localId: string;
  uploadAttemptId?: string;
  placeholderCleaned?: boolean;
}): void {
  void (async () => {
    let provider = "";
    try {
      const d = await getUploadProvider();
      provider = d.provider ?? "";
    } catch {
      provider = "";
    }
    logUploadFailure({
      component: "useUnifiedComposerAttachmentHandlers",
      action: "attachment_upload",
      code: args.code,
      provider,
      signerType: signerTypeForLog(),
      fileName: args.file.name,
      fileMime: args.file.type,
      fileSize: args.file.size,
      rawError: args.message,
      localId: args.localId,
      uploadAttemptId: args.uploadAttemptId,
      placeholderCleaned: args.placeholderCleaned,
    });
  })();
}

export interface UseUnifiedComposerAttachmentHandlersParams {
  blossomMediaBlocked: boolean;
  content: string;
  form: TextPostForm;
  setAttachments: React.Dispatch<React.SetStateAction<ComposerAttachment[]>>;
  mergeThreadSegments: (
    updater: React.SetStateAction<
      Array<{
        id: string;
        content: string;
        attachments: ComposerAttachment[];
      }>
    >
  ) => void;
  isThreadMode: boolean;
  threadSegments: Array<{
    id: string;
    content: string;
    attachments: ComposerAttachment[];
  }>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useUnifiedComposerAttachmentHandlers({
  blossomMediaBlocked,
  content,
  form,
  setAttachments,
  mergeThreadSegments,
  isThreadMode,
  threadSegments,
  fileInputRef,
}: UseUnifiedComposerAttachmentHandlersParams) {
  const processNewFilesForSingleNote = useCallback(
    (files: File[]) => {
      if (blossomMediaBlocked) return;
      const accepted = filterMediaFiles(files);
      if (accepted.length === 0) return;
      const newAttachments: ComposerAttachment[] = accepted.map((file) => ({
        localId: crypto.randomUUID(),
        status: "uploading",
        file,
        mime: composerAttachmentMime(file),
        uploadAttemptId: crypto.randomUUID(),
      }));
      setAttachments((prev) => [...prev, ...newAttachments]);
      void (async () => {
        const preflightOutcomes = await Promise.all(
          accepted.map((f) => preflightMediaUpload(f))
        );
        const uploadQueue: Array<{ file: File; origIndex: number }> = [];
        for (let i = 0; i < preflightOutcomes.length; i++) {
          const pf = preflightOutcomes[i]!;
          const att = newAttachments[i]!;
          if (!pf.ok) {
            setAttachments((prev) =>
              prev.map((a) =>
                a.localId === att.localId
                  ? {
                      ...a,
                      status: "failed" as const,
                      uploadErrorCode: pf.code,
                      uploadErrorMessage: pf.message,
                    }
                  : a
              )
            );
            logAttachmentUploadFailure({
              code: pf.code,
              message: pf.message,
              file: accepted[i]!,
              localId: att.localId,
              uploadAttemptId: att.uploadAttemptId,
              placeholderCleaned: true,
            });
          } else {
            uploadQueue.push({ file: accepted[i]!, origIndex: i });
          }
        }
        if (uploadQueue.length === 0) return;
        const filesToUpload = uploadQueue.map((q) => q.file);
        try {
          const results = await uploadMultipleFiles(filesToUpload);
          for (let j = 0; j < results.length; j++) {
            const origIdx = uploadQueue[j]!.origIndex;
            const att = newAttachments[origIdx]!;
            const r = results[j];
            if (!r) continue;
            const successUrl = r.success ? r.file?.url : undefined;
            if (successUrl) {
              setAttachments((prev) =>
                prev.map((a) =>
                  a.localId === att.localId
                    ? {
                        ...a,
                        status: "done" as const,
                        url: successUrl,
                        uploadErrorCode: undefined,
                        uploadErrorMessage: undefined,
                      }
                    : a
                )
              );
              const body = form.getValues("content");
              if (!getTokenLocalIds(body).includes(att.localId)) {
                form.setValue("content", appendToken(body, att.localId), {
                  shouldDirty: true,
                });
              }
            } else {
              const code =
                r.code ?? inferUploadErrorCodeFromMessage(r.error ?? "");
              const msg = r.error ?? defaultMessageForUploadError(code);
              setAttachments((prev) =>
                prev.map((a) =>
                  a.localId === att.localId
                    ? {
                        ...a,
                        status: "failed" as const,
                        uploadErrorCode: code,
                        uploadErrorMessage: msg,
                      }
                    : a
                )
              );
              logAttachmentUploadFailure({
                code,
                message: msg,
                file: accepted[origIdx]!,
                localId: att.localId,
                uploadAttemptId: att.uploadAttemptId,
                placeholderCleaned: true,
              });
            }
          }
        } catch (error) {
          const mapped = mapUnknownToUploadError(error);
          for (const q of uploadQueue) {
            const att = newAttachments[q.origIndex]!;
            setAttachments((prev) =>
              prev.map((a) =>
                a.localId === att.localId
                  ? {
                      ...a,
                      status: "failed" as const,
                      uploadErrorCode: mapped.code,
                      uploadErrorMessage: mapped.message,
                    }
                  : a
              )
            );
            logAttachmentUploadFailure({
              code: mapped.code,
              message: mapped.message,
              file: accepted[q.origIndex]!,
              localId: att.localId,
              uploadAttemptId: att.uploadAttemptId,
              placeholderCleaned: true,
            });
          }
        }
      })();
    },
    [blossomMediaBlocked, form, setAttachments]
  );

  const processNewFilesForSegment = useCallback(
    (segmentId: string, files: File[]) => {
      if (blossomMediaBlocked) return;
      const accepted = filterMediaFiles(files);
      if (accepted.length === 0) return;
      const newAttachments: ComposerAttachment[] = accepted.map((file) => ({
        localId: crypto.randomUUID(),
        status: "uploading" as const,
        file,
        mime: composerAttachmentMime(file),
        uploadAttemptId: crypto.randomUUID(),
      }));
      mergeThreadSegments((prev) =>
        prev.map((p) => {
          if (p.id !== segmentId) return p;
          return {
            ...p,
            attachments: [...p.attachments, ...newAttachments],
          };
        })
      );
      void (async () => {
        const preflightOutcomes = await Promise.all(
          accepted.map((f) => preflightMediaUpload(f))
        );
        const uploadQueue: Array<{ file: File; origIndex: number }> = [];
        for (let i = 0; i < preflightOutcomes.length; i++) {
          const pf = preflightOutcomes[i]!;
          const att = newAttachments[i]!;
          if (!pf.ok) {
            mergeThreadSegments((prev) =>
              prev.map((p) => {
                if (p.id !== segmentId) return p;
                return {
                  ...p,
                  attachments: p.attachments.map((a) =>
                    a.localId === att.localId
                      ? {
                          ...a,
                          status: "failed" as const,
                          uploadErrorCode: pf.code,
                          uploadErrorMessage: pf.message,
                        }
                      : a
                  ),
                };
              })
            );
            logAttachmentUploadFailure({
              code: pf.code,
              message: pf.message,
              file: accepted[i]!,
              localId: att.localId,
              uploadAttemptId: att.uploadAttemptId,
              placeholderCleaned: true,
            });
          } else {
            uploadQueue.push({ file: accepted[i]!, origIndex: i });
          }
        }
        if (uploadQueue.length === 0) return;
        const filesToUpload = uploadQueue.map((q) => q.file);
        try {
          const results = await uploadMultipleFiles(filesToUpload);
          for (let j = 0; j < results.length; j++) {
            const origIdx = uploadQueue[j]!.origIndex;
            const att = newAttachments[origIdx]!;
            const r = results[j];
            if (!r) continue;
            const successUrl = r.success ? r.file?.url : undefined;
            if (successUrl) {
              mergeThreadSegments((prev) =>
                prev.map((p) => {
                  if (p.id !== segmentId) return p;
                  let newContent = p.content;
                  if (!getTokenLocalIds(p.content).includes(att.localId)) {
                    newContent = appendToken(p.content, att.localId);
                  }
                  return {
                    ...p,
                    content: newContent,
                    attachments: p.attachments.map((a) =>
                      a.localId === att.localId
                        ? {
                            ...a,
                            status: "done" as const,
                            url: successUrl,
                            uploadErrorCode: undefined,
                            uploadErrorMessage: undefined,
                          }
                        : a
                    ),
                  };
                })
              );
            } else {
              const code =
                r.code ?? inferUploadErrorCodeFromMessage(r.error ?? "");
              const msg = r.error ?? defaultMessageForUploadError(code);
              mergeThreadSegments((prev) =>
                prev.map((p) => {
                  if (p.id !== segmentId) return p;
                  return {
                    ...p,
                    attachments: p.attachments.map((a) =>
                      a.localId === att.localId
                        ? {
                            ...a,
                            status: "failed" as const,
                            uploadErrorCode: code,
                            uploadErrorMessage: msg,
                          }
                        : a
                    ),
                  };
                })
              );
              logAttachmentUploadFailure({
                code,
                message: msg,
                file: accepted[origIdx]!,
                localId: att.localId,
                uploadAttemptId: att.uploadAttemptId,
                placeholderCleaned: true,
              });
            }
          }
        } catch (error) {
          const mapped = mapUnknownToUploadError(error);
          for (const q of uploadQueue) {
            const att = newAttachments[q.origIndex]!;
            mergeThreadSegments((prev) =>
              prev.map((p) => {
                if (p.id !== segmentId) return p;
                return {
                  ...p,
                  attachments: p.attachments.map((a) =>
                    a.localId === att.localId
                      ? {
                          ...a,
                          status: "failed" as const,
                          uploadErrorCode: mapped.code,
                          uploadErrorMessage: mapped.message,
                        }
                      : a
                  ),
                };
              })
            );
            logAttachmentUploadFailure({
              code: mapped.code,
              message: mapped.message,
              file: accepted[q.origIndex]!,
              localId: att.localId,
              uploadAttemptId: att.uploadAttemptId,
              placeholderCleaned: true,
            });
          }
        }
      })();
    },
    [blossomMediaBlocked, mergeThreadSegments]
  );

  const handleRetryAttachment = useCallback(
    (localId: string) => {
      if (blossomMediaBlocked) return;
      const attemptId = crypto.randomUUID();
      if (isThreadMode) {
        let segmentId: string | null = null;
        let file: File | null = null;
        for (const s of threadSegments) {
          const a = s.attachments.find((x) => x.localId === localId);
          if (a?.file && a.status === "failed") {
            segmentId = s.id;
            file = a.file;
            break;
          }
        }
        if (!segmentId || !file) return;
        mergeThreadSegments((prev) =>
          prev.map((p) =>
            p.id === segmentId
              ? {
                  ...p,
                  attachments: p.attachments.map((a) =>
                    a.localId === localId
                      ? {
                          ...a,
                          status: "uploading" as const,
                          uploadErrorCode: undefined,
                          uploadErrorMessage: undefined,
                          uploadAttemptId: attemptId,
                        }
                      : a
                  ),
                }
              : p
          )
        );
        void (async () => {
          const pf = await preflightMediaUpload(file);
          if (!pf.ok) {
            mergeThreadSegments((prev) =>
              prev.map((p) =>
                p.id === segmentId
                  ? {
                      ...p,
                      attachments: p.attachments.map((a) =>
                        a.localId === localId
                          ? {
                              ...a,
                              status: "failed" as const,
                              uploadErrorCode: pf.code,
                              uploadErrorMessage: pf.message,
                            }
                          : a
                      ),
                    }
                  : p
              )
            );
            logAttachmentUploadFailure({
              code: pf.code,
              message: pf.message,
              file,
              localId,
              uploadAttemptId: attemptId,
              placeholderCleaned: true,
            });
            return;
          }
          try {
            const retryResults = await uploadMultipleFiles([file]);
            const r = retryResults[0];
            const successUrl = r?.success ? r.file?.url : undefined;
            if (successUrl) {
              mergeThreadSegments((prev) =>
                prev.map((p) => {
                  if (p.id !== segmentId) return p;
                  let newContent = p.content;
                  if (!getTokenLocalIds(p.content).includes(localId)) {
                    newContent = appendToken(p.content, localId);
                  }
                  return {
                    ...p,
                    content: newContent,
                    attachments: p.attachments.map((a) =>
                      a.localId === localId
                        ? {
                            ...a,
                            status: "done" as const,
                            url: successUrl,
                            uploadErrorCode: undefined,
                            uploadErrorMessage: undefined,
                          }
                        : a
                    ),
                  };
                })
              );
            } else {
              const code =
                r?.code ?? inferUploadErrorCodeFromMessage(r?.error ?? "");
              const msg = r?.error ?? defaultMessageForUploadError(code);
              mergeThreadSegments((prev) =>
                prev.map((p) =>
                  p.id === segmentId
                    ? {
                        ...p,
                        attachments: p.attachments.map((a) =>
                          a.localId === localId
                            ? {
                                ...a,
                                status: "failed" as const,
                                uploadErrorCode: code,
                                uploadErrorMessage: msg,
                              }
                            : a
                        ),
                      }
                    : p
                )
              );
              logAttachmentUploadFailure({
                code,
                message: msg,
                file,
                localId,
                uploadAttemptId: attemptId,
                placeholderCleaned: true,
              });
            }
          } catch (error) {
            const mapped = mapUnknownToUploadError(error);
            mergeThreadSegments((prev) =>
              prev.map((p) =>
                p.id === segmentId
                  ? {
                      ...p,
                      attachments: p.attachments.map((a) =>
                        a.localId === localId
                          ? {
                              ...a,
                              status: "failed" as const,
                              uploadErrorCode: mapped.code,
                              uploadErrorMessage: mapped.message,
                            }
                          : a
                      ),
                    }
                  : p
              )
            );
            logAttachmentUploadFailure({
              code: mapped.code,
              message: mapped.message,
              file,
              localId,
              uploadAttemptId: attemptId,
              placeholderCleaned: true,
            });
          }
        })();
        return;
      }

      setAttachments((prev) => {
        const target = prev.find((a) => a.localId === localId);
        if (!target?.file || target.status !== "failed") return prev;
        const f = target.file;
        void (async () => {
          const pf = await preflightMediaUpload(f);
          if (!pf.ok) {
            setAttachments((p) =>
              p.map((a) =>
                a.localId === localId
                  ? {
                      ...a,
                      status: "failed" as const,
                      uploadErrorCode: pf.code,
                      uploadErrorMessage: pf.message,
                    }
                  : a
              )
            );
            logAttachmentUploadFailure({
              code: pf.code,
              message: pf.message,
              file: f,
              localId,
              uploadAttemptId: attemptId,
              placeholderCleaned: true,
            });
            return;
          }
          try {
            const retryResults = await uploadMultipleFiles([f]);
            const r = retryResults[0];
            const successUrl = r?.success ? r.file?.url : undefined;
            if (successUrl) {
              setAttachments((p) =>
                p.map((a) =>
                  a.localId === localId
                    ? {
                        ...a,
                        status: "done" as const,
                        url: successUrl,
                        uploadErrorCode: undefined,
                        uploadErrorMessage: undefined,
                      }
                    : a
                )
              );
              const body = form.getValues("content");
              if (!getTokenLocalIds(body).includes(localId)) {
                form.setValue("content", appendToken(body, localId), {
                  shouldDirty: true,
                });
              }
            } else {
              const code =
                r?.code ?? inferUploadErrorCodeFromMessage(r?.error ?? "");
              const msg = r?.error ?? defaultMessageForUploadError(code);
              setAttachments((p) =>
                p.map((a) =>
                  a.localId === localId
                    ? {
                        ...a,
                        status: "failed" as const,
                        uploadErrorCode: code,
                        uploadErrorMessage: msg,
                      }
                    : a
                )
              );
              logAttachmentUploadFailure({
                code,
                message: msg,
                file: f,
                localId,
                uploadAttemptId: attemptId,
                placeholderCleaned: true,
              });
            }
          } catch (error) {
            const mapped = mapUnknownToUploadError(error);
            setAttachments((p) =>
              p.map((a) =>
                a.localId === localId
                  ? {
                      ...a,
                      status: "failed" as const,
                      uploadErrorCode: mapped.code,
                      uploadErrorMessage: mapped.message,
                    }
                  : a
              )
            );
            logAttachmentUploadFailure({
              code: mapped.code,
              message: mapped.message,
              file: f,
              localId,
              uploadAttemptId: attemptId,
              placeholderCleaned: true,
            });
          }
        })();
        return prev.map((a) =>
          a.localId === localId
            ? {
                ...a,
                status: "uploading" as const,
                uploadErrorCode: undefined,
                uploadErrorMessage: undefined,
                uploadAttemptId: attemptId,
              }
            : a
        );
      });
    },
    [
      blossomMediaBlocked,
      form,
      isThreadMode,
      mergeThreadSegments,
      setAttachments,
      threadSegments,
    ]
  );

  const handleAddAttachment = useCallback(() => {
    if (blossomMediaBlocked) return;
    fileInputRef.current?.click();
  }, [blossomMediaBlocked, fileInputRef]);

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      e.target.value = "";
      if (files.length === 0) return;
      if (blossomMediaBlocked) return;
      processNewFilesForSingleNote(files);
    },
    [blossomMediaBlocked, processNewFilesForSingleNote]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (blossomMediaBlocked) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      const raw: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item?.kind === "file") {
          const file = item.getAsFile();
          if (file) raw.push(file);
        }
      }
      const files = filterMediaFiles(raw);
      if (files.length === 0) return;
      e.preventDefault();
      const firstSegment = threadSegments[0];
      if (isThreadMode && firstSegment) {
        processNewFilesForSegment(firstSegment.id, files);
      } else {
        processNewFilesForSingleNote(files);
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [
    blossomMediaBlocked,
    isThreadMode,
    threadSegments,
    processNewFilesForSingleNote,
    processNewFilesForSegment,
  ]);

  const handleRemoveAttachment = useCallback(
    (localId: string) => {
      form.setValue("content", removeToken(content, localId));
      setAttachments((prev) => prev.filter((a) => a.localId !== localId));
    },
    [content, form, setAttachments]
  );

  const handleReorderAttachments = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex) return;
      setAttachments((prev) => {
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= prev.length ||
          toIndex >= prev.length
        ) {
          return prev;
        }
        const next = [...prev];
        const moved = next.splice(fromIndex, 1)[0];
        if (!moved) return prev;
        next.splice(toIndex, 0, moved);
        const ids = next.map((a) => a.localId);
        const body = form.getValues("content");
        form.setValue("content", reorderAttachmentTokensInContent(body, ids), {
          shouldDirty: true,
        });
        return next;
      });
    },
    [form, setAttachments]
  );

  return {
    processNewFilesForSingleNote,
    processNewFilesForSegment,
    handleAddAttachment,
    onFileChange,
    handleRemoveAttachment,
    handleReorderAttachments,
    handleRetryAttachment,
  };
}
