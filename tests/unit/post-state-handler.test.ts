/**
 * Unit tests for post state handlers
 * Tests app/features/posts/handlers/post-state.handler.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  handleCaptionChange,
  handleDateChange,
  handleRemovePost,
} from "~/features/posts/handlers/post-state.handler";
import type { BulkPost } from "~/features/posts/types";

function makePost(overrides: Partial<BulkPost> = {}): BulkPost {
  return {
    clientId: "p1",
    files: [],
    caption: "",
    queueType: "unassigned",
    scheduledFor: "",
    isRecyclable: false,
    ...overrides,
  };
}

describe("Post State Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleCaptionChange", () => {
    it("updates caption at index and calls setPosts", () => {
      const posts: BulkPost[] = [
        makePost({ clientId: "1", caption: "old" }),
        makePost({ clientId: "2", caption: "other" }),
      ];
      const setPosts = vi.fn();

      handleCaptionChange(0, "new caption", posts, setPosts);

      expect(setPosts).toHaveBeenCalledTimes(1);
      const updated = setPosts.mock.calls[0]?.[0] as BulkPost[] | undefined;
      expect(updated).toHaveLength(2);
      expect(updated?.[0]?.caption).toBe("new caption");
      expect(updated?.[1]?.caption).toBe("other");
    });

    it("does nothing when index is out of bounds", () => {
      const posts: BulkPost[] = [makePost()];
      const setPosts = vi.fn();

      handleCaptionChange(5, "x", posts, setPosts);

      expect(setPosts).not.toHaveBeenCalled();
    });
  });

  describe("handleDateChange", () => {
    it("sets scheduledFor to value and calls setPosts", () => {
      const posts: BulkPost[] = [makePost({ scheduledFor: "" })];
      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        0,
        "2025-06-15T14:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged
      );

      expect(setPosts).toHaveBeenCalledTimes(1);
      const updated = setPosts.mock.calls[0]?.[0] as BulkPost[];
      expect(updated[0]?.scheduledFor).toBe("2025-06-15T14:00");
      expect(setFirstItemTimeManuallyChanged).toHaveBeenCalledWith(true);
    });

    it("clears scheduledFor when value is empty", () => {
      const posts: BulkPost[] = [
        makePost({ scheduledFor: "2025-06-15T14:00" }),
      ];
      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(0, "", posts, setPosts, setFirstItemTimeManuallyChanged);

      const updated = setPosts.mock.calls[0]?.[0] as BulkPost[];
      expect(updated[0]?.scheduledFor).toBe("");
    });

    it("clears scheduledFor when value is whitespace only", () => {
      const posts: BulkPost[] = [
        makePost({ scheduledFor: "2025-06-15T14:00" }),
      ];
      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        0,
        "   ",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged
      );

      const updated = setPosts.mock.calls[0]?.[0] as BulkPost[];
      expect(updated[0]?.scheduledFor).toBe("");
    });

    it("does not call setFirstItemTimeManuallyChanged when index is not 0", () => {
      const posts: BulkPost[] = [
        makePost({ clientId: "1" }),
        makePost({ clientId: "2", scheduledFor: "" }),
      ];
      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        1,
        "2025-06-15T14:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged
      );

      expect(setFirstItemTimeManuallyChanged).not.toHaveBeenCalled();
    });

    it("does nothing when index is out of bounds", () => {
      const posts: BulkPost[] = [makePost()];
      const setPosts = vi.fn();

      handleDateChange(10, "2025-06-15T14:00", posts, setPosts, vi.fn());

      expect(setPosts).not.toHaveBeenCalled();
    });
  });

  describe("handleRemovePost", () => {
    it("removes post at index and calls setPosts", () => {
      const posts: BulkPost[] = [
        makePost({ clientId: "1" }),
        makePost({ clientId: "2" }),
        makePost({ clientId: "3" }),
      ];
      const setPosts = vi.fn();

      handleRemovePost(1, posts, setPosts);

      expect(setPosts).toHaveBeenCalledTimes(1);
      const updated = setPosts.mock.calls[0]?.[0] as BulkPost[];
      expect(updated).toHaveLength(2);
      expect(updated[0]?.clientId).toBe("1");
      expect(updated[1]?.clientId).toBe("3");
    });

    it("handles remove at index 0", () => {
      const posts: BulkPost[] = [
        makePost({ clientId: "1" }),
        makePost({ clientId: "2" }),
      ];
      const setPosts = vi.fn();

      handleRemovePost(0, posts, setPosts);

      const updated = setPosts.mock.calls[0]?.[0] as BulkPost[];
      expect(updated).toHaveLength(1);
      expect(updated[0]?.clientId).toBe("2");
    });
  });
});
