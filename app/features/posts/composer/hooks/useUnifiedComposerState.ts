import { useCallback, useEffect, useRef, useState } from "react";

import { SIGNER_CONFIG_HYDRATED_EVENT } from "~/features/auth/signer";

import type { ComposerAttachment, RepostConditions } from "../../types";
import type { DelayAfterMain } from "../../utils/delay-after-main";
import { MIN_THREAD_SEGMENTS } from "../components/composer/thread-constants";

const SIGNER_LABEL_NIP46 = "NIP-46 (Bunker)";

export interface UseUnifiedComposerStateParams {
  initialTags?: string;
  initialTemplateName?: string;
  initialAttachments?: ComposerAttachment[];
}

export function useUnifiedComposerState({
  initialTags = "",
  initialTemplateName = "",
  initialAttachments = [],
}: UseUnifiedComposerStateParams = {}) {
  const [publishSubmitInFlight, setPublishSubmitInFlight] = useState(false);
  const [lastPublishFailed, setLastPublishFailed] = useState(false);
  const [signerLabel, setSignerLabel] = useState<string | null>(null);
  const [signerReady, setSignerReady] = useState<boolean | null>(null);
  /** NIP-07 bridge in the page (e.g. Alby, nos2x) — uploads can use it without stored signer config. */
  const [windowNostrBridgePresent, setWindowNostrBridgePresent] = useState(
    () => typeof window !== "undefined" && !!window.nostr
  );

  const [selectedHashtags, setSelectedHashtags] = useState(initialTags);
  const [templateName, setTemplateName] = useState(initialTemplateName);
  const [attachments, setAttachments] =
    useState<ComposerAttachment[]>(initialAttachments);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [repostDelayList, setRepostDelayList] = useState<
    Array<{ id: string; value: number; unit: DelayAfterMain["unit"] }>
  >([]);
  const [repostConditions, setRepostConditions] =
    useState<RepostConditions | null>(null);

  const [quoteEntries, setQuoteEntries] = useState<
    Array<{
      id: string;
      value: number;
      unit: DelayAfterMain["unit"];
      caption: string;
    }>
  >([]);

  const [postOptionsOpen, setPostOptionsOpen] = useState(false);
  const [scheduleRandomWindowMinutes, setScheduleRandomWindowMinutes] =
    useState(0);

  const [isThreadMode, setIsThreadMode] = useState(false);
  const [threadSegments, setThreadSegments] = useState<
    Array<{ id: string; content: string; attachments: ComposerAttachment[] }>
  >(() =>
    Array.from({ length: MIN_THREAD_SEGMENTS }, () => ({
      id: crypto.randomUUID(),
      content: "",
      attachments: [] as ComposerAttachment[],
    }))
  );
  const [threadDelayMinutes, setThreadDelayMinutes] = useState(1);
  /** When true, each segment's text is kept prefixed with "1) ", "2) ", … in the stored body. */
  const [threadAutoNumberSegments, setThreadAutoNumberSegments] =
    useState(false);

  const [draggingOverSegmentId, setDraggingOverSegmentId] = useState<
    string | null
  >(null);

  const refreshSignerState = useCallback(() => {
    if (typeof window !== "undefined") {
      setWindowNostrBridgePresent(!!window.nostr);
    }
    void (async () => {
      const { getActiveSignerConfig } = await import("~/features/auth/signer");
      const config = getActiveSignerConfig();
      setSignerReady(!!config);
      setSignerLabel(
        config?.type === "nip46"
          ? SIGNER_LABEL_NIP46
          : config?.type === "nip07"
            ? "NIP-07 extension"
            : null
      );
    })();
  }, []);

  useEffect(() => {
    refreshSignerState();
    const handler = () => refreshSignerState();
    window.addEventListener(SIGNER_CONFIG_HYDRATED_EVENT, handler);
    return () =>
      window.removeEventListener(SIGNER_CONFIG_HYDRATED_EVENT, handler);
  }, [refreshSignerState]);

  return {
    publishSubmitInFlight,
    setPublishSubmitInFlight,
    lastPublishFailed,
    setLastPublishFailed,
    signerLabel,
    signerReady,
    windowNostrBridgePresent,
    refreshSignerState,
    selectedHashtags,
    setSelectedHashtags,
    templateName,
    setTemplateName,
    attachments,
    setAttachments,
    fileInputRef,
    repostDelayList,
    setRepostDelayList,
    repostConditions,
    setRepostConditions,
    quoteEntries,
    setQuoteEntries,
    postOptionsOpen,
    setPostOptionsOpen,
    scheduleRandomWindowMinutes,
    setScheduleRandomWindowMinutes,
    isThreadMode,
    setIsThreadMode,
    threadSegments,
    setThreadSegments,
    threadDelayMinutes,
    setThreadDelayMinutes,
    threadAutoNumberSegments,
    setThreadAutoNumberSegments,
    draggingOverSegmentId,
    setDraggingOverSegmentId,
  };
}
