/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/consistent-type-assertions -- minimal fixtures for utility tests */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  runRepostOrQuotePreparation,
  runUploadPreparation,
} from "~/features/posts/utils/bulk-post-events-fetcher.utils";

const mocks = vi.hoisted(() => ({
  uploadMany: vi.fn(),
  preflightMediaUpload: vi.fn(),
  inferUploadErrorCodeFromMessage: vi.fn(),
  mapUnknownToUploadError: vi.fn(),
  logUploadFailure: vi.fn(),
  nowMillis: vi.fn(),
  nowUTC: vi.fn(),
  buildUploadFormData: vi.fn(),
  createFakeFileUrlData: vi.fn(),
  getFileUrlArray: vi.fn(),
  handleAsyncErrorWithMessage: vi.fn(),
  getErrorMessage: vi.fn(),
}));

vi.mock("~/features/upload/media.client", () => ({
  uploadMany: (...args: unknown[]) => mocks.uploadMany(...args),
}));
vi.mock("~/features/upload/upload-preflight.client", () => ({
  preflightMediaUpload: (...args: unknown[]) =>
    mocks.preflightMediaUpload(...args),
}));
vi.mock("~/features/upload/upload-error-codes", () => ({
  inferUploadErrorCodeFromMessage: (...args: unknown[]) =>
    mocks.inferUploadErrorCodeFromMessage(...args),
  mapUnknownToUploadError: (...args: unknown[]) =>
    mocks.mapUnknownToUploadError(...args),
}));
vi.mock("~/features/upload/upload-failure-log.client", () => ({
  logUploadFailure: (...args: unknown[]) => mocks.logUploadFailure(...args),
}));
vi.mock("~/lib/temporal", () => ({
  nowMillis: (...args: unknown[]) => mocks.nowMillis(...args),
  nowUTC: (...args: unknown[]) => mocks.nowUTC(...args),
}));
vi.mock("~/features/posts/utils/bulk-post-events.utils", () => ({
  buildUploadFormData: (...args: unknown[]) =>
    mocks.buildUploadFormData(...args),
  createFakeFileUrlData: (...args: unknown[]) =>
    mocks.createFakeFileUrlData(...args),
  getFileUrlArray: (...args: unknown[]) => mocks.getFileUrlArray(...args),
}));
vi.mock("~/lib/error-handler.client", () => ({
  handleAsyncErrorWithMessage: (...args: unknown[]) =>
    mocks.handleAsyncErrorWithMessage(...args),
  getErrorMessage: (...args: unknown[]) => mocks.getErrorMessage(...args),
}));

describe("bulk-post-events-fetcher utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mocks.nowMillis.mockReturnValue(1000);
    mocks.nowUTC.mockReturnValue({
      toInstant: () => ({ toString: () => "2026-01-01T00:00:00.000Z" }),
    });
    mocks.inferUploadErrorCodeFromMessage.mockReturnValue("UNKNOWN");
    mocks.mapUnknownToUploadError.mockReturnValue({
      message: "Mapped upload error",
    });
    mocks.getErrorMessage.mockReturnValue("raw error");
    mocks.buildUploadFormData.mockReturnValue(new FormData());
    mocks.createFakeFileUrlData.mockReturnValue([["fake://file"]]);
    mocks.getFileUrlArray.mockReturnValue(["https://existing"]);
    mocks.preflightMediaUpload.mockResolvedValue({ ok: true });
    mocks.uploadMany.mockResolvedValue([
      { success: true, file: { url: "https://u/1" } },
    ]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runRepostOrQuotePreparation sets fake fileUrls and dispatches event", () => {
    const fetcher = { data: null } as { data: unknown };
    const progress = vi.fn();
    const eventSpy = vi.fn();
    document.addEventListener("repostEventsPrepared", eventSpy);

    runRepostOrQuotePreparation(
      [{ files: [] }] as unknown as Parameters<
        typeof runRepostOrQuotePreparation
      >[0],
      fetcher as never,
      progress
    );

    expect(fetcher.data).toEqual({ fileUrls: [["fake://file"]] });
    expect(progress).toHaveBeenCalledWith({
      current: 1,
      total: 4,
      stage: "Processing reposts...",
    });
    expect(eventSpy).toHaveBeenCalled();
    document.removeEventListener("repostEventsPrepared", eventSpy);
  });

  it("runUploadPreparation submits directly when no files exist", async () => {
    const submit = vi.fn();
    const waitingRef = { current: false };

    const ok = await runUploadPreparation({
      posts: [{ files: [] }] as unknown as Parameters<
        typeof runUploadPreparation
      >[0]["posts"],
      fetcher: { submit } as never,
      isWaitingForUploadRef: waitingRef,
      setToast: vi.fn(),
      setIsPreviewSubmitting: vi.fn(),
    });

    expect(ok).toBe(true);
    expect(waitingRef.current).toBe(true);
    expect(submit).toHaveBeenCalled();
  });

  it("returns false when preflight check fails", async () => {
    mocks.preflightMediaUpload.mockResolvedValue({
      ok: false,
      code: "TOO_LARGE",
      message: "Too large",
    });
    const setToast = vi.fn();
    const setIsPreviewSubmitting = vi.fn();

    const ok = await runUploadPreparation({
      posts: [
        { files: [new File(["x"], "a.png", { type: "image/png" })] },
      ] as Parameters<typeof runUploadPreparation>[0]["posts"],
      fetcher: { submit: vi.fn() } as never,
      isWaitingForUploadRef: { current: false },
      setToast,
      setIsPreviewSubmitting,
    });

    expect(ok).toBe(false);
    expect(setToast).toHaveBeenCalledWith({
      type: "error",
      message: "Too large",
    });
    expect(setIsPreviewSubmitting).toHaveBeenCalledWith(false);
    expect(mocks.logUploadFailure).toHaveBeenCalled();
    vi.runAllTimers();
    expect(setToast).toHaveBeenLastCalledWith(null);
  });

  it("returns false and maps error when uploadMany throws", async () => {
    mocks.uploadMany.mockRejectedValue(new Error("network down"));
    const setToast = vi.fn();
    const setIsPreviewSubmitting = vi.fn();

    const ok = await runUploadPreparation({
      posts: [
        { files: [new File(["x"], "a.png", { type: "image/png" })] },
      ] as Parameters<typeof runUploadPreparation>[0]["posts"],
      fetcher: { submit: vi.fn() } as never,
      isWaitingForUploadRef: { current: false },
      setToast,
      setIsPreviewSubmitting,
    });

    expect(ok).toBe(false);
    expect(mocks.handleAsyncErrorWithMessage).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith({
      type: "error",
      message: "Mapped upload error",
    });
    expect(setIsPreviewSubmitting).toHaveBeenCalledWith(false);
  });

  it("handles partial upload failures by logging each failed file", async () => {
    const submit = vi.fn();
    const setToast = vi.fn();
    const setIsPreviewSubmitting = vi.fn();
    mocks.uploadMany.mockResolvedValue([
      { success: true, file: { url: "https://u/1" } },
      { success: false, error: "bad mime" },
    ]);
    mocks.mapUnknownToUploadError.mockReturnValue({ message: "" });

    const ok = await runUploadPreparation({
      posts: [
        { files: [new File(["x"], "a.png", { type: "image/png" })] },
        { files: [new File(["y"], "b.gif", { type: "image/gif" })] },
      ] as Parameters<typeof runUploadPreparation>[0]["posts"],
      fetcher: { submit } as never,
      isWaitingForUploadRef: { current: false },
      setToast,
      setIsPreviewSubmitting,
    });

    expect(ok).toBe(false);
    expect(mocks.inferUploadErrorCodeFromMessage).toHaveBeenCalledWith(
      "bad mime"
    );
    expect(mocks.logUploadFailure).toHaveBeenCalled();
    expect(setToast).toHaveBeenCalledWith({
      type: "error",
      message: "Upload failed: raw error",
    });
    expect(submit).not.toHaveBeenCalled();
  });

  it("handles upload success and submits with optional action", async () => {
    const submit = vi.fn();
    const waitingRef = { current: false };
    mocks.uploadMany.mockResolvedValue([
      { success: true, file: { url: "https://u/1" } },
      { success: true, file: { url: "https://u/2" } },
    ]);
    const progress = vi.fn();

    const ok = await runUploadPreparation({
      posts: [
        { files: [new File(["x"], "a.png", { type: "image/png" })] },
        { files: [new File(["y"], "b.png", { type: "image/png" })] },
      ] as Parameters<typeof runUploadPreparation>[0]["posts"],
      fetcher: { submit } as never,
      isWaitingForUploadRef: waitingRef,
      setToast: vi.fn(),
      setIsPreviewSubmitting: vi.fn(),
      setPreparationProgress: progress,
      submitAction: "/custom",
    });

    expect(ok).toBe(true);
    expect(waitingRef.current).toBe(true);
    expect(progress).toHaveBeenCalled();
    expect(submit).toHaveBeenCalledWith(expect.any(FormData), {
      method: "post",
      action: "/custom",
    });
  });
});
/* eslint-enable @typescript-eslint/consistent-type-assertions */
