import { useEffect } from "react";

export function useUnifiedComposerPublishTouchEffects(
  issueListLength: number,
  publishAttempted: boolean,
  setPublishAttempted: (v: boolean) => void,
  content: string,
  attachmentsLength: number,
  selectedHashtags: string,
  isThreadMode: boolean,
  threadSegments: Array<{ content: string; attachments: unknown[] }>,
  setComposerTouched: (v: boolean) => void,
  publishMode: string,
  selectedQueue: string,
  formScheduledFor: string | undefined,
  schedulingScheduledFor: string | null
) {
  useEffect(() => {
    if (issueListLength === 0 && publishAttempted) {
      queueMicrotask(() => setPublishAttempted(false));
    }
  }, [issueListLength, publishAttempted, setPublishAttempted]);

  useEffect(() => {
    const threadTouch = isThreadMode
      ? threadSegments.some(
          (s) => s.content.trim().length > 0 || s.attachments.length > 0
        )
      : false;
    if (
      content.trim().length > 0 ||
      attachmentsLength > 0 ||
      selectedHashtags.trim().length > 0 ||
      threadTouch
    ) {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [
    content,
    attachmentsLength,
    selectedHashtags,
    isThreadMode,
    threadSegments,
    setComposerTouched,
  ]);

  useEffect(() => {
    if (publishMode !== "now") {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [publishMode, setComposerTouched]);

  useEffect(() => {
    if (selectedQueue !== "unassigned") {
      queueMicrotask(() => setComposerTouched(true));
    }
  }, [selectedQueue, setComposerTouched]);

  useEffect(() => {
    const t = (formScheduledFor ?? schedulingScheduledFor ?? "").trim();
    if (t) queueMicrotask(() => setComposerTouched(true));
  }, [formScheduledFor, schedulingScheduledFor, setComposerTouched]);
}
