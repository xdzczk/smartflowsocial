import { type FetcherWithComponents } from "@remix-run/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  cancelSignerInFlight,
  setSigningInProgress,
} from "~/features/auth/signer";
import {
  signBatchWithRecovery,
  type SignBatchInput,
} from "~/features/auth/signing/sign-batch-with-recovery.client";
import { signingAttempts } from "~/features/auth/signing/signing-attempts.client";
import { durableIntent } from "~/features/auth/signing/use-recoverable-sign.client";
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

const SIGN_RETRY_COPY = "Failed to sign posts. Please try again.";

function buildBulkBatchKey(preparedEvents: PreparedEvent[]): string {
  // Stable-ish per-batch idempotency seed: caption hashes + scheduled
  // times. Combined with a fresh per-attempt random suffix so a retry
  // after a fatal error gets a brand-new server-side dedupe slot.
  const sig = preparedEvents
    .map((e) => `${String(e.scheduledFor)}:${e.caption.length}`)
    .join("|");
  return `bulk:${sig}:${signingAttempts.createSubmissionId()}`;
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
  const activeAttemptIdRef = useRef<string | null>(null);
  const clearSigningState = () => {
    setIsSigning(false);
    setSigningError(null);
  };
  const cancelSigningState = () => {
    pendingRetryRef.current = null;
    const id = activeAttemptIdRef.current;
    if (id) {
      signingAttempts.cancelAttempt(id);
      activeAttemptIdRef.current = null;
    }
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

  // Per-item sign closure shared between the initial pass and the
  // retry pass. The shared helper invokes us with `index` pointing into
  // the items array we passed in, which the caller remaps back onto
  // `preparedEvents` indices via the `signed` result entries.
  const signOneEntry: SignBatchInput<
    PreparedEvent,
    SignedEntryWithIndex
  >["signItem"] = useCallback(async (eventData, _index, signer) => {
    const { nostrEvent, signedEvent } = await nostrAdapter.signEvent(
      eventData.events,
      { clearCacheOnError: false, signer: signer ?? undefined }
    );
    return {
      originalIndex: 0, // placeholder; remapped via SignedBatchEntry.originalIndex
      nostrEvent,
      signedEvent,
      fileUrl: eventData.fileUrl,
      caption: eventData.caption,
      queueType: eventData.queueType,
      isRecyclable: eventData.isRecyclable,
      originalPostId: eventData.originalPostId,
    };
  }, []);

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

      const result = await signBatchWithRecovery<
        PreparedEvent,
        SignedEntryWithIndex
      >({
        items: preparedEvents,
        intent: durableIntent(
          "composer_publish",
          buildBulkBatchKey(preparedEvents),
          "Schedule posts"
        ),
        surface: "bulkposts",
        signItem: signOneEntry,
        onProgress: (current, total) => setSigningProgress({ current, total }),
        onItemFailed: (eventError, eventIndex) => {
          void (async () => {
            const { handleAsyncError } =
              await import("~/lib/error-handler.client");
            handleAsyncError(
              eventError,
              {
                component: "useBulkPostSigning",
                action: "signEvent",
                eventIndex,
              },
              false
            );
          })();
        },
      });
      activeAttemptIdRef.current = result.attemptId;

      // Normalize signed entries with their original indices preserved.
      const signed: SignedEntryWithIndex[] = result.signed.map((entry) => ({
        ...entry.signed,
        originalIndex: entry.originalIndex,
      }));

      if (result.ok) {
        pendingRetryRef.current = null;
        await submitSignedEntries(signed);
        return;
      }

      if (result.reason === "partial") {
        setPartialSignState({
          signedEntries: signed,
          failedIndices: result.failedIndices,
        });
        setSigningError(null);
        return;
      }

      // expired / fatal / cancelled: surface as an error so the host UI
      // re-enables the submit button. The signing-attempts banner has
      // already presented the recovery affordance.
      setSigningError(result.lastError ?? SIGN_RETRY_COPY);
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
      setSigningError(error instanceof Error ? error.message : SIGN_RETRY_COPY);
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
    const { signedEntries: existingSigned, failedIndices } = partialSignState;
    setPartialSignState(null);

    // Build a "retry slice" of just the failed prepared events so the
    // shared helper can drive them through a fresh durable attempt.
    const retryItems: PreparedEvent[] = [];
    const indexMap: number[] = [];
    for (const i of failedIndices) {
      const ev = preparedEvents[i];
      if (!ev) continue;
      retryItems.push(ev);
      indexMap.push(i);
    }
    const total = retryItems.length;
    setSigningProgress({ current: 0, total });

    const result = await signBatchWithRecovery<
      PreparedEvent,
      SignedEntryWithIndex
    >({
      items: retryItems,
      intent: durableIntent(
        "composer_publish",
        buildBulkBatchKey(retryItems),
        "Retry signing"
      ),
      surface: "bulkposts:retry",
      signItem: signOneEntry,
      onProgress: (current) => setSigningProgress({ current, total }),
    });
    activeAttemptIdRef.current = result.attemptId;

    const remapped: SignedEntryWithIndex[] = result.signed.map((entry) => ({
      ...entry.signed,
      originalIndex: indexMap[entry.originalIndex] ?? entry.originalIndex,
    }));
    const newSigned: SignedEntryWithIndex[] = [...existingSigned, ...remapped];
    const stillFailedRelative = result.ok ? [] : result.failedIndices;
    const stillFailed: number[] = stillFailedRelative
      .map((rel) => indexMap[rel])
      .filter((v): v is number => typeof v === "number");

    setSigningInProgress(false);
    setIsSigning(false);
    setSigningProgress(null);

    if (stillFailed.length > 0) {
      setPartialSignState({
        signedEntries: newSigned,
        failedIndices: stillFailed,
      });
    } else if (result.ok) {
      pendingRetryRef.current = null;
      await submitSignedEntries(newSigned);
    } else {
      // expired / fatal / cancelled: surface and let the user retry.
      setSigningError(result.lastError ?? SIGN_RETRY_COPY);
      setPartialSignState({
        signedEntries: newSigned,
        failedIndices: stillFailed,
      });
    }
  }, [partialSignState, preparedEvents, submitSignedEntries, signOneEntry]);

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
    cancelSignerInFlight,
    describeSignerPhase,
    handleSignAndSubmit,
    handleSaveAsDraft,
    handleScheduleSuccessfulOnly,
    handleRetryFailedSigning,
  };
}
