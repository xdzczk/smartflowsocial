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
} from "~/features/posts/bulkposts.handlers";
import type { BulkPost } from "~/features/posts/types";

describe("Bulk Posts Handlers", () => {
  describe("handleCaptionChange", () => {
    it("should update caption for a post at given index", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Post 2", queueType: "unassigned" },
        { caption: "Post 3", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleCaptionChange(1, "Updated Post 2", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Updated Post 2", queueType: "unassigned" },
        { caption: "Post 3", queueType: "unassigned" },
      ]);
    });

    it("should handle empty caption", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleCaptionChange(0, "", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "", queueType: "unassigned" },
      ]);
    });

    it("should handle first post", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleCaptionChange(0, "First Post", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "First Post", queueType: "unassigned" },
      ]);
    });

    it("should handle last post", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Post 2", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleCaptionChange(1, "Last Post", posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Last Post", queueType: "unassigned" },
      ]);
    });
  });

  describe("handleDateChange", () => {
    it("should update scheduledFor for a post at given index", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T11:00",
        },
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        1,
        "2024-01-15T12:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged,
      );

      expect(setPosts).toHaveBeenCalledWith([
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T12:00",
        },
      ]);
    });

    it("should set firstItemTimeManuallyChanged when first post is changed", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        0,
        "2024-01-15T12:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged,
      );

      expect(setFirstItemTimeManuallyChanged).toHaveBeenCalledWith(true);
    });

    it("should not set firstItemTimeManuallyChanged when non-first post is changed", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T11:00",
        },
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(
        1,
        "2024-01-15T12:00",
        posts,
        setPosts,
        setFirstItemTimeManuallyChanged,
      );

      expect(setFirstItemTimeManuallyChanged).not.toHaveBeenCalled();
    });

    it("should handle empty date string", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
      ];

      const setPosts = vi.fn();
      const setFirstItemTimeManuallyChanged = vi.fn();

      handleDateChange(0, "", posts, setPosts, setFirstItemTimeManuallyChanged);

      expect(setPosts).toHaveBeenCalledWith([
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "",
        },
      ]);
    });
  });

  describe("handleRemovePost", () => {
    it("should remove post at given index", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Post 2", queueType: "unassigned" },
        { caption: "Post 3", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleRemovePost(1, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Post 3", queueType: "unassigned" },
      ]);
    });

    it("should remove first post", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Post 2", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleRemovePost(0, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 2", queueType: "unassigned" },
      ]);
    });

    it("should remove last post", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
        { caption: "Post 2", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleRemovePost(1, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned" },
      ]);
    });

    it("should handle single post removal", () => {
      const posts: BulkPost[] = [{ caption: "Post 1", queueType: "unassigned" }];

      const setPosts = vi.fn();

      handleRemovePost(0, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([]);
    });
  });

  describe("handleBulkRecyclableToggle", () => {
    it("should toggle recyclable status for all posts", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned", isRecyclable: false },
        { caption: "Post 2", queueType: "unassigned", isRecyclable: false },
        { caption: "Post 3", queueType: "unassigned", isRecyclable: false },
      ];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned", isRecyclable: true },
        { caption: "Post 2", queueType: "unassigned", isRecyclable: true },
        { caption: "Post 3", queueType: "unassigned", isRecyclable: true },
      ]);
    });

    it("should set all to false if all are true", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned", isRecyclable: true },
        { caption: "Post 2", queueType: "unassigned", isRecyclable: true },
      ];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned", isRecyclable: false },
        { caption: "Post 2", queueType: "unassigned", isRecyclable: false },
      ]);
    });

    it("should set all to true if mixed states", () => {
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned", isRecyclable: true },
        { caption: "Post 2", queueType: "unassigned", isRecyclable: false },
      ];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      // When not all are recyclable, it sets all to true (opposite of allRecyclable which is false)
      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned", isRecyclable: true },
        { caption: "Post 2", queueType: "unassigned", isRecyclable: true },
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
      const posts: BulkPost[] = [
        { caption: "Post 1", queueType: "unassigned" },
      ];

      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { caption: "Post 1", queueType: "unassigned", isRecyclable: true },
      ]);
    });
  });

  describe("handleScheduleIntervalClick", () => {
    it("should update scheduled times based on interval", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T11:00",
        },
        {
          caption: "Post 3",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T12:00",
        },
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(2, posts, setPosts, false); // 2 hour interval

      const updatedPosts = setPosts.mock.calls[0][0];
      expect(updatedPosts).toHaveLength(3);

      // First post should keep its time (base)
      expect(updatedPosts[0].scheduledFor).toMatch(/2024-01-15T10:00/);

      // Second post should be 2 hours after first
      expect(updatedPosts[1].scheduledFor).toMatch(/2024-01-15T12:00/);

      // Third post should be 4 hours after first
      expect(updatedPosts[2].scheduledFor).toMatch(/2024-01-15T14:00/);
    });

    it("should use first post time as base when firstItemTimeManuallyChanged is false", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T11:00",
        },
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, false);

      const updatedPosts = setPosts.mock.calls[0][0];
      expect(updatedPosts[0].scheduledFor).toMatch(/2024-01-15T10:00/);
      expect(updatedPosts[1].scheduledFor).toMatch(/2024-01-15T11:00/);
    });

    it("should use first post time as base when firstItemTimeManuallyChanged is true", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T11:00",
        },
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, true);

      const updatedPosts = setPosts.mock.calls[0][0];
      expect(updatedPosts[0].scheduledFor).toMatch(/2024-01-15T10:00/);
      expect(updatedPosts[1].scheduledFor).toMatch(/2024-01-15T11:00/);
    });

    it("should use current time when first post has no scheduledFor", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T11:00",
        },
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, false);

      const updatedPosts = setPosts.mock.calls[0][0];
      // First post should have a time set (based on current time)
      expect(updatedPosts[0].scheduledFor).toBeTruthy();
      // Should be in datetime-local format
      expect(updatedPosts[0].scheduledFor).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    });

    it("should handle empty posts array", () => {
      const posts: BulkPost[] = [];
      const setPosts = vi.fn();

      handleScheduleIntervalClick(1, posts, setPosts, false);

      expect(setPosts).not.toHaveBeenCalled();
    });

    it("should format dates correctly in datetime-local format", () => {
      const posts: BulkPost[] = [
        {
          caption: "Post 1",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T10:00",
        },
        {
          caption: "Post 2",
          queueType: "unassigned",
          scheduledFor: "2024-01-15T11:00",
        },
      ];

      const setPosts = vi.fn();

      handleScheduleIntervalClick(3, posts, setPosts, false);

      const updatedPosts = setPosts.mock.calls[0][0];
      // Should be in YYYY-MM-DDTHH:mm format
      expect(updatedPosts[0].scheduledFor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
      expect(updatedPosts[1].scheduledFor).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });
  });
});

