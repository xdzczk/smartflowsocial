import { describe, expect, it } from "vitest";

import {
  isConnectionLifecycleErrorMessage,
  isExistingReconnectRunStale,
  shouldCancelExistingReconnectOnHidden,
  shouldDeferExistingReconnectTerminalError,
  shouldResumeExistingReconnectOnVisible,
} from "~/features/auth/reconnect-lifecycle.client";

describe("reconnect lifecycle helpers", () => {
  it("detects lifecycle transport errors", () => {
    expect(isConnectionLifecycleErrorMessage("WebSocket closed")).toBe(true);
    expect(isConnectionLifecycleErrorMessage("SIGNER_TIMEOUT")).toBe(true);
    expect(
      isConnectionLifecycleErrorMessage("subscription closed by relay")
    ).toBe(true);
    expect(isConnectionLifecycleErrorMessage("pubkey mismatch")).toBe(false);
  });

  it("cancels only existing-session reconnect when app hides", () => {
    expect(shouldCancelExistingReconnectOnHidden("reconnecting_existing")).toBe(
      true
    );
    expect(shouldCancelExistingReconnectOnHidden("waiting")).toBe(false);
    expect(shouldCancelExistingReconnectOnHidden("idle")).toBe(false);
  });

  it("resumes existing reconnect only with valid visible-state conditions", () => {
    expect(
      shouldResumeExistingReconnectOnVisible({
        openMode: "default",
        wasHiddenDuringExistingReconnect: true,
        inFlightExistingReconnect: false,
        hasValidExistingSession: true,
      })
    ).toBe(true);

    expect(
      shouldResumeExistingReconnectOnVisible({
        openMode: "new_session",
        wasHiddenDuringExistingReconnect: true,
        inFlightExistingReconnect: false,
        hasValidExistingSession: true,
      })
    ).toBe(false);
  });

  it("defers terminal errors until a foreground-resume failure happens", () => {
    expect(
      shouldDeferExistingReconnectTerminalError({
        lifecycleError: true,
        wasHiddenDuringExistingReconnect: true,
        trigger: "initial",
        foregroundResumeAttemptFailed: false,
      })
    ).toBe(true);

    expect(
      shouldDeferExistingReconnectTerminalError({
        lifecycleError: true,
        wasHiddenDuringExistingReconnect: true,
        trigger: "manual_retry",
        foregroundResumeAttemptFailed: true,
      })
    ).toBe(false);

    expect(
      shouldDeferExistingReconnectTerminalError({
        lifecycleError: true,
        wasHiddenDuringExistingReconnect: true,
        trigger: "foreground_resume",
        foregroundResumeAttemptFailed: false,
      })
    ).toBe(false);
  });

  it("marks stale reconnect runs by run id mismatch", () => {
    expect(isExistingReconnectRunStale({ currentRunId: 2, runId: 1 })).toBe(
      true
    );
    expect(isExistingReconnectRunStale({ currentRunId: 2, runId: 2 })).toBe(
      false
    );
  });
});
