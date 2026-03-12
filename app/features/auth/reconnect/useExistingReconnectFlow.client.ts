/**
 * Existing-reconnect orchestration: try Nostr Connect or bunker, handle failure.
 * Owns in-flight ref, runId ref, wasHidden/foreground-failed refs; wires handleExistingReconnectFailure.
 *
 * Reconnect loop guardrails:
 * - inFlightExistingReconnectRef ensures only one in-flight "existing reconnect" run at a time.
 * - runId is bumped on each start; after any await, runId must be checked (e.g. getIsRunStale) before
 *   updating UI (setState/setError) so a stale run cannot overwrite state. handleExistingReconnectFailure
 *   and the runExisting* modules use getIsRunStale/getCurrentRunId for this.
 */

import { useCallback, useRef } from "react";
import { toast } from "react-hot-toast";

import { getActiveSession } from "~/features/auth/signer";

import {
  debugReconnectTrace,
  TOAST_RECONNECT_SUCCESS,
} from "../reconnect-dialog-utils.client";
import type { ExistingReconnectTrigger } from "../reconnect-lifecycle.client";
import type { ReconnectState } from "../reconnect-state.client";

import { runExistingBunkerReconnect } from "./reconnect-existing-bunker.client";
import { handleExistingReconnectFailure as handleExistingReconnectFailureImpl } from "./reconnect-existing-failure.client";
import { runExistingNostrConnectReconnect } from "./reconnect-existing-nostrconnect.client";

export interface UseExistingReconnectFlowParams {
  expectedPubkeyHex: string | null;
  setState: (s: ReconnectState) => void;
  setError: (e: string | null) => void;
  setExistingReconnectAttempt: (n: number) => void;
  syncRelaysAfterReconnect: () => Promise<void>;
  onReconnectSuccess?: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
  cancelRef: React.MutableRefObject<{ cancel: () => void } | null>;
  getClosedByExternalReconnect: () => boolean;
}

export interface UseExistingReconnectFlowResult {
  tryReconnectWithExistingConnection: (
    trigger?: ExistingReconnectTrigger
  ) => Promise<void>;
  tryReconnectWithExistingBunkerConnection: (
    trigger?: ExistingReconnectTrigger
  ) => Promise<void>;
  handleExistingReconnectFailure: (input: {
    error: unknown;
    runId: number;
    trigger: ExistingReconnectTrigger;
  }) => Promise<void>;
  wasHiddenDuringExistingReconnectRef: React.MutableRefObject<boolean>;
  existingReconnectForegroundAttemptFailedRef: React.MutableRefObject<boolean>;
  existingReconnectRunIdRef: React.MutableRefObject<number>;
  inFlightExistingReconnectRef: React.MutableRefObject<boolean>;
}

export function useExistingReconnectFlow({
  expectedPubkeyHex,
  setState,
  setError,
  setExistingReconnectAttempt,
  syncRelaysAfterReconnect,
  onReconnectSuccess,
  onOpenChange,
  cancelRef,
  getClosedByExternalReconnect,
}: UseExistingReconnectFlowParams): UseExistingReconnectFlowResult {
  const inFlightExistingReconnectRef = useRef(false);
  const existingReconnectRunIdRef = useRef(0);
  const wasHiddenDuringExistingReconnectRef = useRef(false);
  const existingReconnectForegroundAttemptFailedRef = useRef(false);

  const handleExistingReconnectFailure = useCallback(
    async (input: {
      error: unknown;
      runId: number;
      trigger: ExistingReconnectTrigger;
    }) => {
      await handleExistingReconnectFailureImpl({
        ...input,
        getCurrentRunId: () => existingReconnectRunIdRef.current,
        getClosedByExternalReconnect,
        getWasHiddenDuringExistingReconnect: () =>
          wasHiddenDuringExistingReconnectRef.current,
        getForegroundResumeAttemptFailed: () =>
          existingReconnectForegroundAttemptFailedRef.current,
        setState,
        setError,
        setExistingReconnectAttempt,
        setForegroundResumeAttemptFailed: (v) => {
          existingReconnectForegroundAttemptFailedRef.current = v;
        },
        syncRelaysAfterReconnect,
        expectedPubkeyHex,
        onReconnectSuccess,
        onOpenChange,
        toastSuccess: toast.success,
        debugTrace: debugReconnectTrace,
      });
    },
    [
      expectedPubkeyHex,
      onOpenChange,
      onReconnectSuccess,
      setState,
      setError,
      setExistingReconnectAttempt,
      syncRelaysAfterReconnect,
      getClosedByExternalReconnect,
    ]
  );

  const tryReconnectWithExistingConnection = useCallback(
    async (trigger: ExistingReconnectTrigger = "initial") => {
      if (inFlightExistingReconnectRef.current) return;
      const view = getActiveSession();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- view may be null
      const config = view?.connection?.config;
      if (
        !view ||
        config?.type !== "nip46" ||
        config.method !== "nostrconnect_uri"
      ) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You're offline. Check your connection and try again.");
        setState("failed");
        return;
      }
      inFlightExistingReconnectRef.current = true;
      const runId = ++existingReconnectRunIdRef.current;
      if (trigger === "foreground_resume") {
        wasHiddenDuringExistingReconnectRef.current = false;
      }

      setState("reconnecting_existing");
      setError(null);

      try {
        // After await: runExisting* and handleExistingReconnectFailure use getIsRunStale(runId) before any setState.
        await runExistingNostrConnectReconnect({
          connectionView: view,
          expectedPubkeyHex,
          trigger,
          runId,
          getIsRunStale: () => existingReconnectRunIdRef.current !== runId,
          setCancel: (fn) => {
            cancelRef.current = { cancel: fn };
          },
          setState,
          setError,
          setExistingReconnectAttempt,
          syncRelaysAfterReconnect,
          onSuccess: (connectionId) => {
            toast.success(TOAST_RECONNECT_SUCCESS);
            onReconnectSuccess?.(connectionId);
            onOpenChange(false);
          },
        });
      } catch (err) {
        await handleExistingReconnectFailure({ error: err, runId, trigger });
      } finally {
        if (existingReconnectRunIdRef.current === runId) {
          inFlightExistingReconnectRef.current = false;
        }
        if (cancelRef.current) cancelRef.current.cancel();
        cancelRef.current = null;
      }
    },
    [
      handleExistingReconnectFailure,
      expectedPubkeyHex,
      onReconnectSuccess,
      onOpenChange,
      setState,
      setError,
      setExistingReconnectAttempt,
      syncRelaysAfterReconnect,
      cancelRef,
    ]
  );

  const tryReconnectWithExistingBunkerConnection = useCallback(
    async (trigger: ExistingReconnectTrigger = "initial") => {
      if (inFlightExistingReconnectRef.current) return;
      const view = getActiveSession();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- view may be null
      const config = view?.connection?.config;
      if (
        !view ||
        config?.type !== "nip46" ||
        config.method !== "bunker_input"
      ) {
        return;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setError("You're offline. Check your connection and try again.");
        setState("failed");
        return;
      }
      inFlightExistingReconnectRef.current = true;
      const runId = ++existingReconnectRunIdRef.current;
      if (trigger === "foreground_resume") {
        wasHiddenDuringExistingReconnectRef.current = false;
      }

      setState("reconnecting_existing");
      setError(null);

      try {
        // After await: runExisting* and handleExistingReconnectFailure use getIsRunStale(runId) before any setState.
        await runExistingBunkerReconnect({
          connectionView: view,
          expectedPubkeyHex,
          trigger,
          runId,
          getIsRunStale: () => existingReconnectRunIdRef.current !== runId,
          setCancel: (fn) => {
            cancelRef.current = { cancel: fn };
          },
          setState,
          setError,
          setExistingReconnectAttempt,
          syncRelaysAfterReconnect,
          onSuccess: (connectionId) => {
            toast.success(TOAST_RECONNECT_SUCCESS);
            onReconnectSuccess?.(connectionId);
            onOpenChange(false);
          },
        });
      } catch (err) {
        await handleExistingReconnectFailure({ error: err, runId, trigger });
      } finally {
        if (existingReconnectRunIdRef.current === runId) {
          inFlightExistingReconnectRef.current = false;
        }
        if (cancelRef.current) cancelRef.current.cancel();
        cancelRef.current = null;
      }
    },
    [
      handleExistingReconnectFailure,
      expectedPubkeyHex,
      onReconnectSuccess,
      onOpenChange,
      setState,
      setError,
      setExistingReconnectAttempt,
      syncRelaysAfterReconnect,
      cancelRef,
    ]
  );

  return {
    tryReconnectWithExistingConnection,
    tryReconnectWithExistingBunkerConnection,
    handleExistingReconnectFailure,
    wasHiddenDuringExistingReconnectRef,
    existingReconnectForegroundAttemptFailedRef,
    existingReconnectRunIdRef,
    inFlightExistingReconnectRef,
  };
}
