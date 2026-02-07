/**
 * Debounced autosave for composer draft.
 * Submits _action: autosave-draft with content, attachmentMeta, queueType, etc.
 */

import { useFetcher } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ComposerAttachment } from "../types";

const DEBOUNCE_MS = 2500;

interface AutosavePayload {
  content: string;
  attachments: ComposerAttachment[];
  queueType: string;
  queueTypeId?: string | null;
  scheduledFor?: string;
  tags: string;
  hashTagPresetId?: string | null;
}

export function useComposerAutosave(payload: AutosavePayload) {
  const fetcher = useFetcher<{ draftId?: string; saved?: boolean }>();
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevPayloadRef = useRef<string>("");

  const saveNow = useCallback(() => {
    const {
      content,
      attachments,
      queueType,
      queueTypeId,
      scheduledFor,
      tags,
      hashTagPresetId,
    } = payload;
    const attachmentMeta = attachments
      .filter((a) => a.url)
      .map((a) => ({ localId: a.localId, url: a.url, alt: a.alt }));
    const formData = new FormData();
    formData.set("_action", "autosave-draft");
    formData.set("content", content);
    formData.set("queueType", queueType);
    if (queueTypeId) formData.set("queueTypeId", queueTypeId);
    if (scheduledFor) formData.set("scheduledFor", scheduledFor);
    formData.set("tags", tags);
    if (hashTagPresetId) formData.set("hashTagPresetId", hashTagPresetId);
    if (draftId) formData.set("draftId", draftId);
    if (attachmentMeta.length > 0) {
      formData.set("attachmentMeta", JSON.stringify(attachmentMeta));
    }
    fetcher.submit(formData, { method: "post" });
  }, [payload, draftId, fetcher]);

  useEffect(() => {
    const key = JSON.stringify({
      content: payload.content,
      queueType: payload.queueType,
      scheduledFor: payload.scheduledFor,
      tags: payload.tags,
      attachmentCount: payload.attachments.filter((a) => a.url).length,
    });
    if (key === prevPayloadRef.current) return;
    prevPayloadRef.current = key;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    timeoutRef.current = setTimeout(() => {
      timeoutRef.current = null;
      saveNow();
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [
    payload.content,
    payload.queueType,
    payload.scheduledFor,
    payload.tags,
    payload.attachments,
    saveNow,
  ]);

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const data = fetcher.data as { draftId?: string; saved?: boolean };
      if (data.saved) {
        const nextDraftId = data.draftId ?? null;
        const timer = setTimeout(() => {
          setLastSavedAt(new Date());
          if (nextDraftId) setDraftId(nextDraftId);
        }, 0);
        return () => clearTimeout(timer);
      }
    }
  }, [fetcher.data, fetcher.state]);

  return {
    lastSavedAt,
    saving: fetcher.state !== "idle",
    saveNow,
    draftId,
  };
}
