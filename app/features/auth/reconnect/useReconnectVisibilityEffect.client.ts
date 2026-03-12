/**
 * Single visibility effect: cancel on hidden, resume on visible (existing reconnect or pending URI).
 */

import { useEffect } from "react";

import { getActiveSession } from "~/features/auth/signer";

import { debugReconnectTrace } from "../reconnect-dialog-utils.client";
import {
  shouldCancelExistingReconnectOnHidden,
  shouldResumeExistingReconnectOnVisible,
} from "../reconnect-lifecycle.client";
import type { ReconnectState } from "../reconnect-state.client";
import { getPendingReconnect } from "../reconnect-uri.client";

export interface UseReconnectVisibilityEffectParams {
  open: boolean;
  openMode: "default" | "new_session";
  state: string;
  setState: (s: ReconnectState) => void;
  setExistingReconnectAttempt: (n: number) => void;
  wasHiddenDuringExistingReconnectRef: React.MutableRefObject<boolean>;
  inFlightExistingReconnectRef: React.MutableRefObject<boolean>;
  existingReconnectRunIdRef: React.MutableRefObject<number>;
  triedExistingRef: React.MutableRefObject<boolean>;
  cancelRef: React.MutableRefObject<{ cancel: () => void } | null>;
  tryReconnectWithExistingConnection: (trigger: "foreground_resume") => void;
  tryReconnectWithExistingBunkerConnection: (
    trigger: "foreground_resume"
  ) => void;
  resumeReconnectWithPendingUriRef: React.MutableRefObject<() => void>;
  inFlightNostrConnectRef: React.MutableRefObject<boolean>;
}

export function useReconnectVisibilityEffect({
  open,
  openMode,
  state,
  setState,
  setExistingReconnectAttempt,
  wasHiddenDuringExistingReconnectRef,
  inFlightExistingReconnectRef,
  existingReconnectRunIdRef,
  triedExistingRef,
  cancelRef,
  tryReconnectWithExistingConnection,
  tryReconnectWithExistingBunkerConnection,
  resumeReconnectWithPendingUriRef,
  inFlightNostrConnectRef,
}: UseReconnectVisibilityEffectParams): void {
  useEffect(() => {
    if (!open) return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        if (shouldCancelExistingReconnectOnHidden(state)) {
          wasHiddenDuringExistingReconnectRef.current = true;
          existingReconnectRunIdRef.current += 1;
          inFlightExistingReconnectRef.current = false;
          if (cancelRef.current) cancelRef.current.cancel();
          cancelRef.current = null;
          setState("idle");
          setExistingReconnectAttempt(0);
          debugReconnectTrace(
            "Visibility hidden: cancelled in-flight existing-connection reconnect"
          );
        }
        return;
      }

      const activeView = getActiveSession();
      const activeConfig = activeView?.connection.config;
      const hasValidExistingConnection = activeConfig?.type === "nip46";
      if (
        shouldResumeExistingReconnectOnVisible({
          openMode,
          wasHiddenDuringExistingReconnect:
            wasHiddenDuringExistingReconnectRef.current,
          inFlightExistingReconnect: inFlightExistingReconnectRef.current,
          hasValidExistingSession: hasValidExistingConnection,
        })
      ) {
        setTimeout(() => {
          const method =
            activeConfig?.type === "nip46" ? activeConfig.method : undefined;
          if (method === "bunker_input") {
            tryReconnectWithExistingBunkerConnection("foreground_resume");
          } else {
            tryReconnectWithExistingConnection("foreground_resume");
          }
        }, 500);
        return;
      }

      if (state === "waiting" && getPendingReconnect()) {
        if (inFlightNostrConnectRef.current) {
          if (cancelRef.current) cancelRef.current.cancel();
          cancelRef.current = null;
          inFlightNostrConnectRef.current = false;
          debugReconnectTrace(
            "Visibility return: cancelled stale in-flight connect before resume"
          );
        }
        setTimeout(() => {
          if (getPendingReconnect()) {
            resumeReconnectWithPendingUriRef.current();
          }
        }, 500);
        return;
      }

      if (
        openMode !== "new_session" &&
        state === "idle" &&
        triedExistingRef.current
      ) {
        const view = getActiveSession();
        const config = view?.connection.config;
        const method =
          config?.type === "nip46" && "method" in config
            ? config.method
            : undefined;

        if (method === "bunker_input") {
          setTimeout(() => {
            tryReconnectWithExistingBunkerConnection("foreground_resume");
          }, 500);
        } else if (config?.type === "nip46") {
          setTimeout(() => {
            tryReconnectWithExistingConnection("foreground_resume");
          }, 500);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [
    open,
    openMode,
    state,
    setState,
    setExistingReconnectAttempt,
    wasHiddenDuringExistingReconnectRef,
    inFlightExistingReconnectRef,
    existingReconnectRunIdRef,
    triedExistingRef,
    cancelRef,
    tryReconnectWithExistingConnection,
    tryReconnectWithExistingBunkerConnection,
    resumeReconnectWithPendingUriRef,
    inFlightNostrConnectRef,
  ]);
}
