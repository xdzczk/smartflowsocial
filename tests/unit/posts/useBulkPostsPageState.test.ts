/**
 * @vitest-environment jsdom
 * Unit tests for useBulkPostsPageState (Phase 1.3): return shape, initial state, handler presence.
 */

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockNavigate = vi.fn();
const mockSetSearchParams = vi.fn();
vi.mock("@remix-run/react", () => ({
  useFetcher: () => ({
    data: undefined,
    state: "idle",
    submit: vi.fn(),
  }),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(), mockSetSearchParams],
}));

vi.mock("~/lib/remix-utils", () => ({
  useOptionalUser: () => ({
    id: "user-1",
    timezone: "UTC",
    scheduleInterval: [2],
  }),
}));

vi.mock("~/features/posts/composer", () => ({
  useLocalDraft: () => ({
    restored: null,
    saveSnapshot: vi.fn(),
    clearSnapshot: vi.fn(),
  }),
}));

vi.mock("~/features/posts/server", () => ({
  handleBulkQueueUpdate: vi.fn(),
  handleBulkRecyclableToggle: vi.fn(),
  handleCaptionChange: vi.fn(),
  handleDateChange: vi.fn(),
  handleFileChange: vi.fn(),
  processBulkSelectedFiles: vi.fn(),
  handleIsRecyclableChange: vi.fn(),
  handleQueueTypeChange: vi.fn(),
  handleRemovePost: vi.fn(),
  handleScheduleIntervalClick: vi.fn(),
}));

vi.mock("~/features/posts/utils/bulk-posts.client", () => ({
  getFileUrlArrayForDraft: (p: { fileUrl?: string | string[] }) =>
    Array.isArray(p.fileUrl) ? p.fileUrl : p.fileUrl ? [p.fileUrl] : [],
}));

vi.mock("~/features/posts/utils/client-id", () => ({
  createBulkPostClientId: () => "test-client-id",
}));

import { useBulkPostsPageState } from "~/features/posts/hooks/useBulkPostsPageState";

const defaultProps = {
  tags: ["tag1"],
  queueTypes: [{ id: "q1", name: "Main" }],
  hashTagPresets: [{ id: "h1", name: "Preset", tags: "#a #b" }],
  mode: null,
  groupId: null,
  bulkDraftGroupPosts: [],
};

describe("useBulkPostsPageState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ provider: "s3" }),
    }) as typeof fetch;
  });

  it("returns state and handlers", () => {
    const { result } = renderHook(() => useBulkPostsPageState(defaultProps));

    expect(result.current).toHaveProperty("state");
    expect(result.current).toHaveProperty("handlers");
  });

  it("state includes posts, toast, isProcessing, scheduleIntervals", () => {
    const { result } = renderHook(() => useBulkPostsPageState(defaultProps));

    const { state } = result.current;
    expect(Array.isArray(state.posts)).toBe(true);
    expect(state.posts).toHaveLength(0);
    expect(state.toast).toBeNull();
    expect(state.isProcessing).toBe(false);
    expect(state.scheduleIntervals).toEqual([2]);
  });

  it("handlers include handleCaptionChange, handleDateChange, handleBulkQueueUpdate", () => {
    const { result } = renderHook(() => useBulkPostsPageState(defaultProps));

    const { handlers } = result.current;
    expect(typeof handlers.handleCaptionChange).toBe("function");
    expect(typeof handlers.handleDateChange).toBe("function");
    expect(typeof handlers.handleBulkQueueUpdate).toBe("function");
    expect(typeof handlers.handleQueueTypeChange).toBe("function");
    expect(typeof handlers.handleRemovePost).toBe("function");
    expect(typeof handlers.handleScheduleIntervalClick).toBe("function");
  });
});
