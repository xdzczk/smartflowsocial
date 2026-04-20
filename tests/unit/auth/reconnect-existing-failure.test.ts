/**
 * Unit tests for handleExistingReconnectFailure (reconnect-existing-failure.client.ts).
 * Covers: stale runId skip, closedByExternal skip, defer terminal error, primary failover recovered/not.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAttemptPrimarySignerFailover = vi.fn();
const mockGetActiveSession = vi.fn();
vi.mock("~/features/auth/signer", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    attemptPrimarySignerFailover: (...args: unknown[]) =>
      mockAttemptPrimarySignerFailover(...args),
    getActiveSession: () => mockGetActiveSession(),
  };
});

import { handleExistingReconnectFailure } from "~/features/auth/reconnect/reconnect-existing-failure.client";

describe("reconnect-existing-failure", () => {
  const setState = vi.fn();
  const setError = vi.fn();
  const setExistingReconnectAttempt = vi.fn();
  const setForegroundResumeAttemptFailed = vi.fn();
  const onReconnectSuccess = vi.fn();
  const onOpenChange = vi.fn();
  const toastSuccess = vi.fn();
  const debugTrace = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("(1) does nothing when run is stale (getCurrentRunId !== runId)", async () => {
    await handleExistingReconnectFailure({
      error: new Error("Connection failed"),
      runId: 1,
      trigger: "initial",
      getCurrentRunId: () => 2,
      getClosedByExternalReconnect: () => false,
      getWasHiddenDuringExistingReconnect: () => false,
      getForegroundResumeAttemptFailed: () => false,
      setState,
      setError,
      setExistingReconnectAttempt,
      setForegroundResumeAttemptFailed,
      expectedPubkeyHex: null,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
      debugTrace,
    });
    expect(mockAttemptPrimarySignerFailover).not.toHaveBeenCalled();
    expect(setState).not.toHaveBeenCalled();
    expect(setError).not.toHaveBeenCalled();
  });

  it("(2) does nothing when getClosedByExternalReconnect is true", async () => {
    await handleExistingReconnectFailure({
      error: new Error("Connection failed"),
      runId: 1,
      trigger: "initial",
      getCurrentRunId: () => 1,
      getClosedByExternalReconnect: () => true,
      getWasHiddenDuringExistingReconnect: () => false,
      getForegroundResumeAttemptFailed: () => false,
      setState,
      setError,
      setExistingReconnectAttempt,
      setForegroundResumeAttemptFailed,
      expectedPubkeyHex: null,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
      debugTrace,
    });
    expect(mockAttemptPrimarySignerFailover).not.toHaveBeenCalled();
    expect(debugTrace).toHaveBeenCalledWith(
      "Skipping failure handling: dialog already closed by external reconnect"
    );
  });

  it("(3) sets state idle and clears error when shouldDeferExistingReconnectTerminalError (no toast)", async () => {
    await handleExistingReconnectFailure({
      error: new Error("WebSocket closed"),
      runId: 1,
      trigger: "initial",
      getCurrentRunId: () => 1,
      getClosedByExternalReconnect: () => false,
      getWasHiddenDuringExistingReconnect: () => true,
      getForegroundResumeAttemptFailed: () => false,
      setState,
      setError,
      setExistingReconnectAttempt,
      setForegroundResumeAttemptFailed,
      expectedPubkeyHex: null,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
      debugTrace,
    });
    expect(mockAttemptPrimarySignerFailover).not.toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith("idle");
    expect(setExistingReconnectAttempt).toHaveBeenCalledWith(0);
    expect(setError).toHaveBeenCalledWith(null);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("(4) when attemptPrimarySignerFailover recovered: syncRelays, setState connected, toast, onOpenChange(false)", async () => {
    mockAttemptPrimarySignerFailover.mockResolvedValue({ recovered: true });
    mockGetActiveSession.mockReturnValue({
      connection: { id: "conn-1" },
      currentSession: null,
    });

    await handleExistingReconnectFailure({
      error: new Error("Timeout"),
      runId: 1,
      trigger: "initial",
      getCurrentRunId: () => 1,
      getClosedByExternalReconnect: () => false,
      getWasHiddenDuringExistingReconnect: () => false,
      getForegroundResumeAttemptFailed: () => false,
      setState,
      setError,
      setExistingReconnectAttempt,
      setForegroundResumeAttemptFailed,
      expectedPubkeyHex: null,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
      debugTrace,
    });

    expect(mockAttemptPrimarySignerFailover).toHaveBeenCalled();
    expect(setExistingReconnectAttempt).toHaveBeenCalledWith(0);
    expect(setState).toHaveBeenCalledWith("connected");
    expect(toastSuccess).toHaveBeenCalled();
    expect(onReconnectSuccess).toHaveBeenCalledWith("conn-1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("(5) when attemptPrimarySignerFailover not recovered: setState idle, setError, setExistingReconnectAttempt", async () => {
    mockAttemptPrimarySignerFailover.mockResolvedValue({
      recovered: false,
      reason: "no_primary_profile",
    });

    await handleExistingReconnectFailure({
      error: new Error("Timeout"),
      runId: 1,
      trigger: "manual_retry",
      getCurrentRunId: () => 1,
      getClosedByExternalReconnect: () => false,
      getWasHiddenDuringExistingReconnect: () => false,
      getForegroundResumeAttemptFailed: () => false,
      setState,
      setError,
      setExistingReconnectAttempt,
      setForegroundResumeAttemptFailed,
      expectedPubkeyHex: null,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
      debugTrace,
    });

    expect(mockAttemptPrimarySignerFailover).toHaveBeenCalled();
    expect(setState).toHaveBeenCalledWith("idle");
    expect(setExistingReconnectAttempt).toHaveBeenCalledWith(0);
    expect(setError).toHaveBeenCalledWith(
      expect.stringContaining("Could not reconnect with existing connection")
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("sets foregroundResumeAttemptFailed when trigger is foreground_resume and failover did not recover", async () => {
    mockAttemptPrimarySignerFailover.mockResolvedValue({
      recovered: false,
      reason: "timeout",
    });

    await handleExistingReconnectFailure({
      error: new Error("Timeout"),
      runId: 1,
      trigger: "foreground_resume",
      getCurrentRunId: () => 1,
      getClosedByExternalReconnect: () => false,
      getWasHiddenDuringExistingReconnect: () => false,
      getForegroundResumeAttemptFailed: () => false,
      setState,
      setError,
      setExistingReconnectAttempt,
      setForegroundResumeAttemptFailed,
      expectedPubkeyHex: null,
      onReconnectSuccess,
      onOpenChange,
      toastSuccess,
      debugTrace,
    });

    expect(setForegroundResumeAttemptFailed).toHaveBeenCalledWith(true);
  });
});
