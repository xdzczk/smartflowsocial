/**
 * Unit tests for bulk posts handlers
 *
 * Tests the pure utility functions in app/features/posts/bulkposts.handlers.ts
 * Note: Functions that require React state or fetch are tested separately or in E2E tests
 */

import { describe, it, expect, vi } from "vitest";

import {
  handleCaptionChange,
  handleDateChange,
  handleRemovePost,
  handleBulkRecyclableToggle,
  handleScheduleIntervalClick,
} from "~/features/posts/server";
import type { BulkPost } from "~/features/posts/types";

// Helper to create minimal BulkPost objects for testing
const createBulkPost = (overrides: Partial<BulkPost> = {}): BulkPost => ({
  caption: "",
  queueType: "unassigned",
  file: null,
  scheduledFor: "",
  isRecyclable: false,
  ...overrides,
});

describe("Bulk Posts Handlers", () => {
  describe("handleCaptionChange", () => {
    it("should update caption for a post at given index", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Post 2" }),
        createBulkPost({ caption: "Post 3" }),
      ];

      const setPosts = vi.fn();

      handleCaptionChange(1, "Updated Post 2", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Updated Post 2" }),
        createBulkPost({ caption: "Post 3" }),
      ]);
    });

    it("should handle empty caption", () => {
      const posts: BulkPost[] = [createBulkPost({ caption: "Post 1" })];

      const setPosts = vi.fn();

      handleCaptionChange(0, "", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([createBulkPost({ caption: "" })]);
    });

    it("should handle first post", () => {
      const posts: BulkPost[] = [createBulkPost({ caption: "Post 1" })];

      const setPosts = vi.fn();

      handleCaptionChange(0, "First Post", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "First Post" }),
      ]);
    });

    it("should handle last post", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Post 2" }),
      ];

      const setPosts = vi.fn();

      handleCaptionChange(1, "Last Post", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Last Post" }),
      ]);
    });
  });

  describe("handleDateChange", () => {
    it("should update scheduledFor for a post at given index", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T11:00" }),
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        1,
        "2024-01-15T12:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged
      );

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T12:00" }),
      ]);
    });

    it("should set firstItemTimeManuallyChanged when first post is changed", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        0,
        "2024-01-15T12:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged
      );

      expect(setFirstItemTimeManuallyChanged).toHaveBeenCalledWith(true);
    });

    it("should not set firstItemTimeManuallyChanged when non-first post is changed", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T11:00" }),
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        1,
        "2024-01-15T12:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged
      );

      expect(setFirstItemTimeManuallyChanged).not.toHaveBeenCalled();
    });

    it("should handle empty date string", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(0, "", posts, setPosts, setFirstItemTimeManuallyChanged);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1", scheduledFor: "" }),
      ]);
    });
  });

  describe("handleRemovePost", () => {
    it("should remove post at given index", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Post 2" }),
        createBulkPost({ caption: "Post 3" }),
      ];

      const setPosts = vi.fn();

      handleRemovePost(1, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Post 3" }),
      ]);
    });

    it("should remove first post", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Post 2" }),
      ];

      const setPosts = vi.fn();

      handleRemovePost(0, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 2" }),
      ]);
    });

    it("should remove last post", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1" }),
        createBulkPost({ caption: "Post 2" }),
      ];

      const setPosts = vi.fn();

      handleRemovePost(1, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1" }),
      ]);
    });

    it("should handle single post removal", () => {
      const posts: BulkPost[] = [createBulkPost({ caption: "Post 1" })];

      const setPosts = vi.fn();

      handleRemovePost(0, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([]);
    });
  });

  describe("handleBulkRecyclableToggle", () => {
    it("should toggle recyclable status for all posts", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", isRecyclable: false }),
        createBulkPost({ caption: "Post 2", isRecyclable: false }),
        createBulkPost({ caption: "Post 3", isRecyclable: false }),
      ];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1", isRecyclable: true }),
        createBulkPost({ caption: "Post 2", isRecyclable: true }),
        createBulkPost({ caption: "Post 3", isRecyclable: true }),
      ]);
    });

    it("should set all to false if all are true", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", isRecyclable: true }),
        createBulkPost({ caption: "Post 2", isRecyclable: true }),
      ];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1", isRecyclable: false }),
        createBulkPost({ caption: "Post 2", isRecyclable: false }),
      ]);
    });

    it("should set all to true if mixed states", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", isRecyclable: true }),
        createBulkPost({ caption: "Post 2", isRecyclable: false }),
      ];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      // When not all are recyclable, it sets all to true (opposite of allRecyclable which is false)
      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1", isRecyclable: true }),
        createBulkPost({ caption: "Post 2", isRecyclable: true }),
      ]);
    });

    it("should handle empty posts array", () => {
      const posts: BulkPost[] = [];
      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      // Function returns early if posts array is empty, so setPosts should not be called
      expect(setPosts).not.toHaveBeenCalled();
    });

    it("should handle posts without isRecyclable field", () => {
      const posts: BulkPost[] = [createBulkPost({ caption: "Post 1" })];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        createBulkPost({ caption: "Post 1", isRecyclable: true }),
      ]);
    });
  });

  describe("handleScheduleIntervalClick", () => {
    it("should update scheduled times based on interval", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T11:00" }),
        createBulkPost({ caption: "Post 3", scheduledFor: "2024-01-15T12:00" }),
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(2, posts, setPosts, false); // 2 hour interval

      const calls =
        Array.isArray(setPosts.mock.calls) && setPosts.mock.calls[0]
          ? setPosts.mock.calls[0]
          : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
      const updatedPostsRaw =
        Array.isArray(calls) && calls[0] ? calls[0] : null;
      const updatedPosts = Array.isArray(updatedPostsRaw)
        ? updatedPostsRaw
        : [];
      expect(updatedPosts).toHaveLength(3);

      // First post should keep its time (base)
      const firstPost =
        updatedPosts[0] &&
        typeof updatedPosts[0] === "object" &&
        !Array.isArray(updatedPosts[0])
          ? (updatedPosts[0] as { scheduledFor?: string })
          : {};
      expect(firstPost.scheduledFor).toMatch(/2024-01-15T10:00/);

      // Second post should be 2 hours after first
      const secondPost =
        updatedPosts[1] &&
        typeof updatedPosts[1] === "object" &&
        !Array.isArray(updatedPosts[1])
          ? (updatedPosts[1] as { scheduledFor?: string })
          : {};
      expect(secondPost.scheduledFor).toMatch(/2024-01-15T12:00/);

      // Third post should be 4 hours after first
      const thirdPost =
        updatedPosts[2] &&
        typeof updatedPosts[2] === "object" &&
        !Array.isArray(updatedPosts[2])
          ? (updatedPosts[2] as { scheduledFor?: string })
          : {};
      expect(thirdPost.scheduledFor).toMatch(/2024-01-15T14:00/);
    });

    it("should use first post time as base when firstItemTimeManuallyChanged is false", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T11:00" }),
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, false);

      const calls =
        Array.isArray(setPosts.mock.calls) && setPosts.mock.calls[0]
          ? setPosts.mock.calls[0]
          : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
      const updatedPostsRaw =
        Array.isArray(calls) && calls[0] ? calls[0] : null;
      const updatedPosts = Array.isArray(updatedPostsRaw)
        ? updatedPostsRaw
        : [];
      const firstPost =
        updatedPosts[0] &&
        typeof updatedPosts[0] === "object" &&
        !Array.isArray(updatedPosts[0])
          ? (updatedPosts[0] as { scheduledFor?: string })
          : {};
      const secondPost =
        updatedPosts[1] &&
        typeof updatedPosts[1] === "object" &&
        !Array.isArray(updatedPosts[1])
          ? (updatedPosts[1] as { scheduledFor?: string })
          : {};
      expect(firstPost.scheduledFor).toMatch(/2024-01-15T10:00/);
      expect(secondPost.scheduledFor).toMatch(/2024-01-15T11:00/);
    });

    it("should use first post time as base when firstItemTimeManuallyChanged is true", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T11:00" }),
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, true);

      const calls =
        Array.isArray(setPosts.mock.calls) && setPosts.mock.calls[0]
          ? setPosts.mock.calls[0]
          : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
      const updatedPostsRaw =
        Array.isArray(calls) && calls[0] ? calls[0] : null;
      const updatedPosts = Array.isArray(updatedPostsRaw)
        ? updatedPostsRaw
        : [];
      const firstPost =
        updatedPosts[0] &&
        typeof updatedPosts[0] === "object" &&
        !Array.isArray(updatedPosts[0])
          ? (updatedPosts[0] as { scheduledFor?: string })
          : {};
      const secondPost =
        updatedPosts[1] &&
        typeof updatedPosts[1] === "object" &&
        !Array.isArray(updatedPosts[1])
          ? (updatedPosts[1] as { scheduledFor?: string })
          : {};
      expect(firstPost.scheduledFor).toMatch(/2024-01-15T10:00/);
      expect(secondPost.scheduledFor).toMatch(/2024-01-15T11:00/);
    });

    it("should use current time when first post has no scheduledFor", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T11:00" }),
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, false);

      const calls =
        Array.isArray(setPosts.mock.calls) && setPosts.mock.calls[0]
          ? setPosts.mock.calls[0]
          : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
      const updatedPostsRaw =
        Array.isArray(calls) && calls[0] ? calls[0] : null;
      const updatedPosts = Array.isArray(updatedPostsRaw)
        ? updatedPostsRaw
        : [];
      const firstPost =
        updatedPosts[0] &&
        typeof updatedPosts[0] === "object" &&
        !Array.isArray(updatedPosts[0])
          ? (updatedPosts[0] as { scheduledFor?: string })
          : {};
      // First post should have a time set (based on current time)
      expect(firstPost.scheduledFor).toBeTruthy();
      // Should be in datetime-local format
      expect(firstPost.scheduledFor).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });

    it("should handle empty posts array", () => {
      const posts: BulkPost[] = [];
      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, false);

      expect(setPosts).not.toHaveBeenCalled();
    });

    it("should format dates correctly in datetime-local format", () => {
      const posts: BulkPost[] = [
        createBulkPost({ caption: "Post 1", scheduledFor: "2024-01-15T10:00" }),
        createBulkPost({ caption: "Post 2", scheduledFor: "2024-01-15T11:00" }),
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(3, posts, setPosts, false);

      const calls =
        Array.isArray(setPosts.mock.calls) && setPosts.mock.calls[0]
          ? setPosts.mock.calls[0]
          : [];
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Jest expect matchers have complex types
      const updatedPostsRaw =
        Array.isArray(calls) && calls[0] ? calls[0] : null;
      const updatedPosts = Array.isArray(updatedPostsRaw)
        ? updatedPostsRaw
        : [];
      const firstPost =
        updatedPosts[0] &&
        typeof updatedPosts[0] === "object" &&
        !Array.isArray(updatedPosts[0])
          ? (updatedPosts[0] as { scheduledFor?: string })
          : {};
      const secondPost =
        updatedPosts[1] &&
        typeof updatedPosts[1] === "object" &&
        !Array.isArray(updatedPosts[1])
          ? (updatedPosts[1] as { scheduledFor?: string })
          : {};
      // Should be in YYYY-MM-DDTHH:mm format
      expect(firstPost.scheduledFor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(secondPost.scheduledFor).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/
      );
    });
  });
});
