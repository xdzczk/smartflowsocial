/**
 * Integration tests for recyclable handler
 * Tests app/features/posts/handlers/recyclable.handler.ts
 */

import { describe, it, expect, vi } from "vitest";

import {
  handleIsRecyclableChange,
  handleBulkRecyclableToggle,
} from "~/features/posts/handlers/recyclable.handler";
import type { BulkPost } from "~/features/posts/types";

describe("Recyclable Handler", () => {
  describe("handleIsRecyclableChange", () => {
    it("should update recyclable status for a single post", () => {
      const posts: BulkPost[] = [
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
      ];
      const setPosts = vi.fn();

      handleIsRecyclableChange(0, true, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
      ]);
    });

    it("should set recyclable to false", () => {
      const posts: BulkPost[] = [
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
      ];
      const setPosts = vi.fn();

      handleIsRecyclableChange(0, false, posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
      ]);
    });
  });

  describe("handleBulkRecyclableToggle", () => {
    it("should toggle all posts to recyclable when none are recyclable", () => {
      const posts: BulkPost[] = [
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
      ];
      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
      ]);
    });

    it("should toggle all posts to non-recyclable when all are recyclable", () => {
      const posts: BulkPost[] = [
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
      ];
      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).toHaveBeenCalledWith([
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
      ]);
    });

    it("should toggle all to recyclable when mixed states", () => {
      const posts: BulkPost[] = [
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: false },
      ];
      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      // When not all are recyclable, it toggles all to true
      expect(setPosts).toHaveBeenCalledWith([
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
        { file: null, caption: "", queueType: "unassigned", scheduledFor: "", isRecyclable: true },
      ]);
    });

    it("should not call setPosts for empty array", () => {
      const posts: BulkPost[] = [];
      const setPosts = vi.fn();

      handleBulkRecyclableToggle(posts, setPosts);

      expect(setPosts).not.toHaveBeenCalled();
    });
  });
});

