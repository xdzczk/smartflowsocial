import { useCallback, useEffect, useRef, useState } from "react";

import { SIGNER_CONFIG_HYDRATED_EVENT } from "~/features/auth/signer";

import type { ComposerAttachment, RepostConditions } from "../../types";
import type { DelayAfterMain } from "../../utils/delay-after-main";

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
  const [draftPickerOpen, setDraftPickerOpen] = useState(false);
  const [publishSubmitInFlight, setPublishSubmitInFlight] = useState(false);
  const [lastPublishFailed, setLastPublishFailed] = useState(false);
  const [signerLabel, setSignerLabel] = useState<string | null>(null);
  const [signerReady, setSignerReady] = useState<boolean | null>(null);

  const [selectedHashtags, setSelectedHashtags] = useState(initialTags);
  const [templateName, setTemplateName] = useState(initialTemplateName);
  const [attachments, setAttachments] =
    useState<ComposerAttachment[]>(initialAttachments);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [alsoScheduleRepost, setAlsoScheduleRepost] = useState(false);
  const [repostDelayList, setRepostDelayList] = useState<
    Array<{ id: string; value: number; unit: DelayAfterMain["unit"] }>
  >([{ id: crypto.randomUUID(), value: 2, unit: "hours" }]);
  const [repostConditions, setRepostConditions] =
    useState<RepostConditions | null>(null);

  const [alsoScheduleQuote, setAlsoScheduleQuote] = useState(false);
  const [quoteEntries, setQuoteEntries] = useState<
    Array<{
      id: string;
      value: number;
      unit: DelayAfterMain["unit"];
      caption: string;
    }>
  >([{ id: crypto.randomUUID(), value: 2, unit: "hours", caption: "" }]);

  const [postOptionsOpen, setPostOptionsOpen] = useState(false);
  const [scheduleRandomWindowMinutes, setScheduleRandomWindowMinutes] =
    useState(0);

  const [isThreadMode, setIsThreadMode] = useState(false);
  const [threadSegments, setThreadSegments] = useState<
    Array<{ id: string; content: string; attachments: ComposerAttachment[] }>
  >([{ id: crypto.randomUUID(), content: "", attachments: [] }]);
  const [threadDelayMinutes, setThreadDelayMinutes] = useState(1);

  const [draggingOverSegmentId, setDraggingOverSegmentId] = useState<
    string | null
  >(null);

  const refreshSignerState = useCallback(() => {
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
    draftPickerOpen,
    setDraftPickerOpen,
    publishSubmitInFlight,
    setPublishSubmitInFlight,
    lastPublishFailed,
    setLastPublishFailed,
    signerLabel,
    signerReady,
    refreshSignerState,
    selectedHashtags,
    setSelectedHashtags,
    templateName,
    setTemplateName,
    attachments,
    setAttachments,
    fileInputRef,
    alsoScheduleRepost,
    setAlsoScheduleRepost,
    repostDelayList,
    setRepostDelayList,
    repostConditions,
    setRepostConditions,
    alsoScheduleQuote,
    setAlsoScheduleQuote,
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
    draggingOverSegmentId,
    setDraggingOverSegmentId,
  };
}
