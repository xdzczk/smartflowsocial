import { useCallback, useEffect } from "react";
import type { UseFormReturn } from "react-hook-form";

import { uploadMany as uploadMultipleFiles } from "~/features/upload/media.client";

import type { ComposerAttachment } from "../../../types";
import {
  appendToken,
  removeToken,
  reorderAttachmentTokensInContent,
} from "../../../utils/inline-tokens.client";
import type { TextPostFormData } from "../../hooks/composer-submit-types";
import {
  composerAttachmentMime,
  filterMediaFiles,
} from "../composer/composer-helpers";

type TextPostForm = UseFormReturn<TextPostFormData>;

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
      }));
      let newContent = content;
      for (const a of newAttachments) {
        newContent = appendToken(newContent, a.localId);
      }
      form.setValue("content", newContent);
      setAttachments((prev) => [...prev, ...newAttachments]);
      void (async () => {
        try {
          const results = await uploadMultipleFiles(accepted);
          setAttachments((prev) =>
            prev.map((a) => {
              const idx = newAttachments.findIndex(
                (n) => n.localId === a.localId
              );
              if (idx < 0) return a;
              const r = results[idx];
              if (r?.success && r.file?.url) {
                return { ...a, status: "done" as const, url: r.file.url };
              }
              if (r && !r.success) {
                return { ...a, status: "failed" as const };
              }
              return a;
            })
          );
        } catch {
          setAttachments((prev) =>
            prev.map((a) => {
              const idx = newAttachments.findIndex(
                (n) => n.localId === a.localId
              );
              if (idx >= 0) return { ...a, status: "failed" as const };
              return a;
            })
          );
        }
      })();
    },
    [blossomMediaBlocked, content, form, setAttachments]
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
      }));
      mergeThreadSegments((prev) =>
        prev.map((p) => {
          if (p.id !== segmentId) return p;
          let newContent = p.content;
          for (const a of newAttachments) {
            newContent = appendToken(newContent, a.localId);
          }
          return {
            ...p,
            content: newContent,
            attachments: [...p.attachments, ...newAttachments],
          };
        })
      );
      void (async () => {
        try {
          const results = await uploadMultipleFiles(accepted);
          mergeThreadSegments((prev) =>
            prev.map((p) => {
              if (p.id !== segmentId) return p;
              return {
                ...p,
                attachments: p.attachments.map((a) => {
                  const idx = newAttachments.findIndex(
                    (n) => n.localId === a.localId
                  );
                  if (idx < 0) return a;
                  const r = results[idx];
                  if (r?.success && r.file?.url)
                    return {
                      ...a,
                      status: "done" as const,
                      url: r.file.url,
                    };
                  if (r && !r.success)
                    return { ...a, status: "failed" as const };
                  return a;
                }),
              };
            })
          );
        } catch {
          mergeThreadSegments((prev) =>
            prev.map((p) => {
              if (p.id !== segmentId) return p;
              return {
                ...p,
                attachments: p.attachments.map((a) => {
                  const idx = newAttachments.findIndex(
                    (n) => n.localId === a.localId
                  );
                  return idx >= 0 ? { ...a, status: "failed" as const } : a;
                }),
              };
            })
          );
        }
      })();
    },
    [blossomMediaBlocked, mergeThreadSegments]
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
  };
}
