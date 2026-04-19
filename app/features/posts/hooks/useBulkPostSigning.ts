import { type FetcherWithComponents } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  setSigningInProgress,
  tryBackgroundReconnect,
} from "~/features/auth/signer";
import type { SignedEvent } from "~/features/nostr/types";
import { useComposerSignerReconnect } from "~/features/posts/composer/hooks/useComposerSignerReconnect";
import {
  describeSignerPhase,
  useSignAttemptProgress,
} from "~/lib/hooks/useSignAttemptProgress";
import { nostrAdapter } from "~/lib/nostr-adapter.client";

import type { BulkPost, PreparedEvent, RepostConditions } from "../types";
import {
  buildAndSignQuoteSchedules,
  buildAndSignRepostSchedules,
} from "../utils/repost-quote-events.client";

/** Signed post with original index for building form and repost/quote by index */
export interface SignedEntryWithIndex {
  originalIndex: number;
  nostrEvent: unknown;
  signedEvent: unknown;
  fileUrl: unknown;
  caption: unknown;
  queueType: string;
  isRecyclable: boolean;
  originalPostId: string | null | undefined;
}

export interface PartialSignState {
  signedEntries: SignedEntryWithIndex[];
  failedIndices: number[];
}

export interface UseBulkPostSigningParams {
  preparedEvents: PreparedEvent[];
  posts: BulkPost[];
  groupId?: string | null;
  submitAction?: string;
  extraFormData?: Record<string, string>;
  repostConditions?: RepostConditions | null;
  fetcher: FetcherWithComponents<{ error?: string }>;
}

export function useBulkPostSigning({
  preparedEvents,
  posts,
  groupId = null,
  submitAction: submitActionProp,
  extraFormData,
  repostConditions,
  fetcher,
}: UseBulkPostSigningParams) {
  const isSubmitting = fetcher.state !== "idle";
  const [isSigning, setIsSigning] = useState(false);
  const [signingError, setSigningError] = useState<string | null>(null);
  const [signingProgress, setSigningProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [partialSignState, setPartialSignState] =
    useState<PartialSignState | null>(null);
  const { signAttempt, signElapsedSeconds } = useSignAttemptProgress(isSigning);

  const actionError =
    fetcher.state === "idle" &&
    fetcher.data != null &&
    typeof fetcher.data === "object"
      ? (() => {
          const data = fetcher.data as {
            error?: string | { message?: string };
          };
          if (typeof data.error === "string") {
            return data.error;
          }
          if (
            data.error != null &&
            typeof data.error === "object" &&
            typeof data.error.message === "string"
          ) {
            return data.error.message;
          }
          return null;
        })()
      : null;

  useEffect(() => {
    if (actionError) {
      setSigningError(actionError);
    }
  }, [actionError]);

  const pendingRetryRef = useRef<(() => void) | null>(null);
  const clearSigningState = () => {
    setIsSigning(false);
    setSigningError(null);
  };
  const cancelSigningState = () => {
    pendingRetryRef.current = null;
    clearSigningState();
  };
  const retryLastSign = (): boolean => {
    const fn = pendingRetryRef.current;
    if (!fn) return false;
    pendingRetryRef.current = null;
    fn();
    return true;
  };
  useComposerSignerReconnect(cancelSigningState, isSigning, retryLastSign);

  const submitSignedEntries = useCallback(
    async (signedEntries: SignedEntryWithIndex[]) => {
      const finalFormData = new FormData();
      for (const data of signedEntries) {
        finalFormData.append("nostrEvent", JSON.stringify(data.nostrEvent));
        finalFormData.append("signedEvents", JSON.stringify(data.signedEvent));
        finalFormData.append("fileUrl", JSON.stringify(data.fileUrl));
        finalFormData.append("caption", JSON.stringify(data.caption));
        finalFormData.append("queueType", data.queueType);
        finalFormData.append(
          "isRecyclable",
          data.isRecyclable ? "true" : "false"
        );
        finalFormData.append("originalPostId", data.originalPostId ?? "");
      }
      for (const signedEntry of signedEntries) {
        const i = signedEntry.originalIndex;
        const eventData = preparedEvents[i];
        const mainScheduledUnix =
          typeof eventData?.scheduledFor === "number"
            ? eventData.scheduledFor
            : 0;
        const mainSigned = signedEntry.signedEvent as
          | { tags?: string[][] }
          | undefined;
        const tagArray = Array.isArray(mainSigned?.tags) ? mainSigned.tags : [];

        const repostSched = posts[i]?.repostSchedules;
        if (repostSched && repostSched.length > 0 && mainScheduledUnix > 0) {
          const repostArr = await buildAndSignRepostSchedules(
            mainScheduledUnix,
            repostSched,
            signedEntry.signedEvent as SignedEvent
          );
          const withConditions =
            repostConditions && Object.keys(repostConditions).length > 0
              ? repostArr.map((e) => ({ ...e, ...repostConditions }))
              : repostArr;
          finalFormData.append(
            "repostSchedules",
            JSON.stringify(withConditions)
          );
        } else {
          finalFormData.append("repostSchedules", JSON.stringify([]));
        }

        const quoteSched = posts[i]?.quoteSchedules;
        if (quoteSched && quoteSched.length > 0 && mainScheduledUnix > 0) {
          const quoteArr = await buildAndSignQuoteSchedules(
            mainScheduledUnix,
            quoteSched,
            signedEntry.signedEvent as SignedEvent,
            tagArray
          );
          finalFormData.append("quoteSchedules", JSON.stringify(quoteArr));
        } else {
          finalFormData.append("quoteSchedules", JSON.stringify([]));
        }
      }
      finalFormData.append("_action", "sign_and_schedule");
      if (extraFormData) {
        Object.entries(extraFormData).forEach(([k, v]) =>
          finalFormData.append(k, v)
        );
      }
      const actionUrl =
        submitActionProp ??
        `/dashboard/bulkposts${new URL(window.location.href).search}`;
      fetcher.submit(finalFormData, {
        method: "post",
        encType: "multipart/form-data",
        action: actionUrl,
      });
    },
    [
      preparedEvents,
      posts,
      repostConditions,
      fetcher,
      submitActionProp,
      extraFormData,
    ]
  );

  async function handleSignAndSubmit() {
    try {
      setSigningError(null);
      setPartialSignState(null);
      setIsSigning(true);
      setSigningInProgress(true);
      pendingRetryRef.current = () => {
        void handleSignAndSubmit();
      };
      setSigningProgress({ current: 0, total: preparedEvents.length });

      const signed: SignedEntryWithIndex[] = [];
      let failedIndices: number[] = [];

      for (let index = 0; index < preparedEvents.length; index++) {
        const eventData = preparedEvents[index];
        if (!eventData) {
          throw new Error("Missing prepared event data");
        }
        try {
          const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
            eventData.events,
            { clearCacheOnError: false }
          );
          signed.push({
            originalIndex: index,
            nostrEvent,
            signedEvent,
            fileUrl: eventData.fileUrl,
            caption: eventData.caption,
            queueType: eventData.queueType,
            isRecyclable: eventData.isRecyclable,
            originalPostId: eventData.originalPostId,
          });
          setSigningProgress({
            current: index + 1,
            total: preparedEvents.length,
          });
          if (index < preparedEvents.length - 1) {
            await new Promise((r) => setTimeout(r, 100));
          }
        } catch (eventError) {
          const { handleAsyncError } =
            await import("~/lib/error-handler.client");
          handleAsyncError(
            eventError,
            {
              component: "useBulkPostSigning",
              action: "signEvent",
              eventIndex: index,
            },
            false
          );
          failedIndices.push(index);
        }
      }

      if (failedIndices.length > 0) {
        setSigningProgress({
          current: preparedEvents.length,
          total: preparedEvents.length,
        });
        await new Promise((r) => setTimeout(r, 1500));
        const stillFailed: number[] = [];
        for (const index of failedIndices) {
          const ev = preparedEvents[index];
          if (!ev) continue;
          try {
            const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
              ev.events,
              { clearCacheOnError: false }
            );
            signed.push({
              originalIndex: index,
              nostrEvent,
              signedEvent,
              fileUrl: ev.fileUrl,
              caption: ev.caption,
              queueType: ev.queueType,
              isRecyclable: ev.isRecyclable,
              originalPostId: ev.originalPostId,
            });
            await new Promise((r) => setTimeout(r, 100));
          } catch {
            stillFailed.push(index);
          }
        }
        failedIndices = stillFailed;
      }

      if (failedIndices.length > 0) {
        setPartialSignState({ signedEntries: signed, failedIndices });
        setSigningError(null);
      } else {
        pendingRetryRef.current = null;
        await submitSignedEntries(signed);
      }
    } catch (error) {
      const { handleAsyncError } = await import("~/lib/error-handler.client");
      handleAsyncError(
        error,
        {
          component: "useBulkPostSigning",
          action: "handleSignAndSubmit",
        },
        false
      );
      setSigningError(
        error instanceof Error
          ? error.message
          : "Failed to sign posts. Please try again."
      );
    } finally {
      setSigningInProgress(false);
      pendingRetryRef.current = null;
      setIsSigning(false);
      setSigningProgress(null);
    }
  }

  const handleScheduleSuccessfulOnly = useCallback(() => {
    if (!partialSignState) return;
    void submitSignedEntries(partialSignState.signedEntries);
    setPartialSignState(null);
    setSigningError(null);
  }, [partialSignState, submitSignedEntries]);

  const handleRetryFailedSigning = useCallback(async () => {
    if (!partialSignState || partialSignState.failedIndices.length === 0) {
      setPartialSignState(null);
      return;
    }
    setIsSigning(true);
    setSigningInProgress(true);
    setPartialSignState(null);
    const { signedEntries: existingSigned, failedIndices } = partialSignState;
    const newSigned: SignedEntryWithIndex[] = [...existingSigned];
    const stillFailed: number[] = [];
    const total = failedIndices.length;
    setSigningProgress({ current: 0, total });
    let current = 0;
    for (const index of failedIndices) {
      const eventData = preparedEvents[index];
      if (!eventData) continue;
      try {
        const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
          eventData.events,
          { clearCacheOnError: false }
        );
        newSigned.push({
          originalIndex: index,
          nostrEvent,
          signedEvent,
          fileUrl: eventData.fileUrl,
          caption: eventData.caption,
          queueType: eventData.queueType,
          isRecyclable: eventData.isRecyclable,
          originalPostId: eventData.originalPostId,
        });
        current += 1;
        setSigningProgress({ current, total });
        await new Promise((r) => setTimeout(r, 100));
      } catch {
        stillFailed.push(index);
      }
    }
    setSigningInProgress(false);
    setIsSigning(false);
    setSigningProgress(null);
    if (stillFailed.length > 0) {
      setPartialSignState({
        signedEntries: newSigned,
        failedIndices: stillFailed,
      });
    } else {
      pendingRetryRef.current = null;
      await submitSignedEntries(newSigned);
    }
  }, [partialSignState, preparedEvents, submitSignedEntries]);

  const handleSaveAsDraft = useCallback(() => {
    const finalFormData = new FormData();
    preparedEvents.forEach((eventData) => {
      finalFormData.append("fileUrl", JSON.stringify(eventData.fileUrl));
      finalFormData.append("caption", JSON.stringify(eventData.caption));
      finalFormData.append("queueType", eventData.queueType);
      finalFormData.append("scheduledFor", String(eventData.scheduledFor));
      finalFormData.append(
        "isRecyclable",
        eventData.isRecyclable ? "true" : "false"
      );

      finalFormData.append("originalPostId", eventData.originalPostId ?? "");
    });
    finalFormData.append("_action", "save_as_draft");
    if (groupId) {
      finalFormData.append("groupId", groupId);
    }
    if (extraFormData) {
      Object.entries(extraFormData).forEach(([k, v]) =>
        finalFormData.append(k, v)
      );
    }

    const actionUrl =
      submitActionProp ??
      `/dashboard/bulkposts${new URL(window.location.href).search}`;

    fetcher.submit(finalFormData, {
      method: "post",
      encType: "multipart/form-data",
      action: actionUrl,
    });
  }, [preparedEvents, groupId, extraFormData, submitActionProp, fetcher]);

  return {
    isSubmitting,
    isSigning,
    signingError,
    signingProgress,
    partialSignState,
    setPartialSignState,
    signAttempt,
    signElapsedSeconds,
    actionError,
    cancelSigningState,
    tryBackgroundReconnect,
    describeSignerPhase,
    handleSignAndSubmit,
    handleSaveAsDraft,
    handleScheduleSuccessfulOnly,
    handleRetryFailedSigning,
  };
}
