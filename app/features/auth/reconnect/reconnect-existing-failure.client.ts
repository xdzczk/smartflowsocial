/**
 * Handle "existing reconnect failed": defer, primary failover, or show error.
 * No React; receives all side effects via callbacks.
 */

import {
  attemptPrimarySignerFailover,
  getActiveSession,
} from "~/features/auth/signer";

import { TOAST_RECONNECT_SUCCESS } from "../reconnect-dialog-utils.client";
import {
  isConnectionLifecycleErrorMessage,
  isExistingReconnectRunStale,
  shouldDeferExistingReconnectTerminalError,
  type ExistingReconnectTrigger,
} from "../reconnect-lifecycle.client";
import type { ReconnectState } from "../reconnect-state.client";

export interface HandleExistingReconnectFailureOptions {
  error: unknown;
  runId: number;
  trigger: ExistingReconnectTrigger;
  getCurrentRunId: () => number;
  getClosedByExternalReconnect: () => boolean;
  getWasHiddenDuringExistingReconnect: () => boolean;
  getForegroundResumeAttemptFailed: () => boolean;
  setState: (s: ReconnectState) => void;
  setError: (e: string | null) => void;
  setExistingReconnectAttempt: (n: number) => void;
  setForegroundResumeAttemptFailed: (v: boolean) => void;
  expectedPubkeyHex: string | null;
  onReconnectSuccess?: (connectionId: string) => void;
  onOpenChange: (open: boolean) => void;
  toastSuccess: (msg: string) => void;
  debugTrace: (msg: string, details?: Record<string, unknown>) => void;
}

export async function handleExistingReconnectFailure(
  options: HandleExistingReconnectFailureOptions
): Promise<void> {
  const {
    error,
    runId,
    trigger,
    getCurrentRunId,
    getClosedByExternalReconnect,
    getWasHiddenDuringExistingReconnect,
    getForegroundResumeAttemptFailed,
    setState,
    setError,
    setExistingReconnectAttempt,
    setForegroundResumeAttemptFailed,
    expectedPubkeyHex,
    onReconnectSuccess,
    onOpenChange,
    toastSuccess,
    debugTrace,
  } = options;

  if (
    isExistingReconnectRunStale({
      currentRunId: getCurrentRunId(),
      runId,
    })
  ) {
    return;
  }
  if (getClosedByExternalReconnect()) {
    debugTrace(
      "Skipping failure handling: dialog already closed by external reconnect"
    );
    return;
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  const lifecycleError = isConnectionLifecycleErrorMessage(errorMessage);

  if (
    trigger !== "foreground_resume" &&
    shouldDeferExistingReconnectTerminalError({
      lifecycleError,
      wasHiddenDuringExistingReconnect: getWasHiddenDuringExistingReconnect(),
      trigger,
      foregroundResumeAttemptFailed: getForegroundResumeAttemptFailed(),
    })
  ) {
    debugTrace(
      "Existing-connection reconnect failed during app-switch window; deferring terminal error",
      { trigger, error: errorMessage }
    );
    setState("idle");
    setExistingReconnectAttempt(0);
    setError(null);
    return;
  }

  debugTrace("Existing-connection reconnect failed; trying primary failover", {
    error: errorMessage,
  });

  const fallback = await attemptPrimarySignerFailover({
    expectedPubkey: expectedPubkeyHex,
    labelFallback: "Primary Home Signer",
  });
  if (
    isExistingReconnectRunStale({
      currentRunId: getCurrentRunId(),
      runId,
    })
  ) {
    return;
  }
  if (fallback.recovered) {
    debugTrace("Primary failover recovered reconnect");
    setExistingReconnectAttempt(0);
    setState("connected");
    toastSuccess(TOAST_RECONNECT_SUCCESS);
    const recoveredView = getActiveSession();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- recoveredView may be null
    const connectionId = recoveredView?.connection?.id;
    if (connectionId) {
      onReconnectSuccess?.(connectionId);
    }
    onOpenChange(false);
    return;
  }
  debugTrace("Primary failover did not recover reconnect", {
    reason: fallback.reason ?? "unknown",
  });

  if (trigger === "foreground_resume") {
    setForegroundResumeAttemptFailed(true);
  } else if (
    shouldDeferExistingReconnectTerminalError({
      lifecycleError,
      wasHiddenDuringExistingReconnect: getWasHiddenDuringExistingReconnect(),
      trigger,
      foregroundResumeAttemptFailed: getForegroundResumeAttemptFailed(),
    })
  ) {
    debugTrace(
      "Suppressing terminal reconnect error until foreground resume attempt fails",
      { trigger }
    );
    setState("idle");
    setExistingReconnectAttempt(0);
    setError(null);
    return;
  }

  setState("idle");
  setExistingReconnectAttempt(0);
  setError(
    "Could not reconnect with existing connection. If the connection is still in your signer app, switch to it, reactivate the connection, then return here — we'll retry automatically. Or generate a new connection string below."
  );
}
