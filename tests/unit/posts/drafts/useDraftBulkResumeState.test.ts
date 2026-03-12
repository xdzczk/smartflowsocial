/**
 * @vitest-environment jsdom
 * Unit tests for useDraftBulkResumeState: initial state, handler shapes, effect on fetcher success.
 */

import { renderHook, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchScheduledTime = vi.fn();
const mockApplyOffsetAndFormat = vi.fn();
vi.mock("~/features/posts/drafts/utils/draft-bulk-resume.utils", () => ({
  fetchScheduledTime: (...args: unknown[]) => mockFetchScheduledTime(...args),
  applyOffsetAndFormat: (...args: unknown[]) =>
    mockApplyOffsetAndFormat(...args),
}));

const mockUseFetcher = vi.fn();
const mockUseOptionalUser = vi.fn();
vi.mock("@remix-run/react", () => ({
  useFetcher: () => mockUseFetcher(),
}));
vi.mock("~/lib/remix-utils", () => ({
  useOptionalUser: () => mockUseOptionalUser(),
}));

import { useDraftBulkResumeState } from "~/features/posts/drafts/hooks/useDraftBulkResumeState";
import type { PostData, QueueType } from "~/features/posts/types";

describe("useDraftBulkResumeState", () => {
  const onCancel = vi.fn();
  const selectedDrafts = [
    {
      id: "d1",
      content: "Post 1",
      caption: "Cap 1",
      fileUrl: [],
      queueType: { name: "Unassigned" },
    },
    {
      id: "d2",
      content: "Post 2",
      caption: "Cap 2",
      fileUrl: [],
      queueType: { name: "Unassigned" },
    },
  ] as unknown as PostData[];
  const queueTypes = [
    { name: "Unassigned" },
    {
      name: "Main",
      scheduleType: "INTERVAL",
      scheduleConfig: { intervalHours: 2 },
    },
  ] as unknown as QueueType[];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFetcher.mockReturnValue({
      data: undefined,
      submit: vi.fn(),
      state: "idle",
    });
    mockUseOptionalUser.mockReturnValue({
      id: "user-1",
      timezone: "UTC",
      scheduleInterval: [2],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns initial posts from selectedDrafts with scheduledFor set", () => {
    const { result } = renderHook(() =>
      useDraftBulkResumeState({
        selectedDrafts,
        queueTypes,
        onCancel,
      })
    );

    expect(result.current.posts).toHaveLength(2);
    expect(result.current.posts[0]?.id).toBe("d1");
    expect(result.current.posts[1]?.id).toBe("d2");
    expect(result.current.posts[0]?.scheduledFor).toBeDefined();
    expect(result.current.posts[0]?.scheduledFor).not.toBe("");
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.signingError).toBeNull();
  });

  it("returns user and scheduleIntervals from useOptionalUser", () => {
    const user = { id: "u", timezone: "UTC", scheduleInterval: [4] };
    mockUseOptionalUser.mockReturnValue(user);

    const { result } = renderHook(() =>
      useDraftBulkResumeState({
        selectedDrafts,
        queueTypes,
        onCancel,
      })
    );

    expect(result.current.user).toEqual(user);
    expect(result.current.scheduleIntervals).toEqual([4]);
  });

  it("exposes all handler functions", () => {
    const { result } = renderHook(() =>
      useDraftBulkResumeState({
        selectedDrafts,
        queueTypes,
        onCancel,
      })
    );

    const { handlers } = result.current;
    expect(typeof handlers.clearSigningState).toBe("function");
    expect(typeof handlers.retryLastSign).toBe("function");
    expect(typeof handlers.handleQueueTypeChange).toBe("function");
    expect(typeof handlers.handleDateChange).toBe("function");
    expect(typeof handlers.handleScheduleIntervalClick).toBe("function");
    expect(typeof handlers.handleBulkQueueUpdate).toBe("function");
    expect(typeof handlers.handleSignAndResume).toBe("function");
  });

  it("calls onCancel when fetcher.data.success is true", () => {
    let fetcherData: unknown = undefined;
    mockUseFetcher.mockImplementation(() => ({
      get data() {
        return fetcherData;
      },
      submit: vi.fn(),
      state: "idle",
    }));

    const { rerender } = renderHook(() =>
      useDraftBulkResumeState({
        selectedDrafts,
        queueTypes,
        onCancel,
      })
    );

    expect(onCancel).not.toHaveBeenCalled();

    fetcherData = { success: true };
    mockUseFetcher.mockImplementation(() => ({
      get data() {
        return fetcherData;
      },
      submit: vi.fn(),
      state: "idle",
    }));
    rerender();

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("handleDateChange updates post scheduledFor", () => {
    const { result } = renderHook(() =>
      useDraftBulkResumeState({
        selectedDrafts,
        queueTypes,
        onCancel,
      })
    );

    const newDate = "2024-06-15T14:00";
    act(() => {
      result.current.handlers.handleDateChange(0, newDate);
    });

    expect(result.current.posts[0]?.scheduledFor).toBe(newDate);
  });

  it("clearSigningState resets isSubmitting and signingError", () => {
    const { result } = renderHook(() =>
      useDraftBulkResumeState({
        selectedDrafts,
        queueTypes,
        onCancel,
      })
    );

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.signingError).toBeNull();

    act(() => {
      result.current.handlers.clearSigningState();
    });

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.signingError).toBeNull();
  });
});
