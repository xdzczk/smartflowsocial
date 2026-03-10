/**
 * Unit tests for bulk posts loader utilities
 * Tests app/features/posts/utils/bulkposts-loader.utils.ts
 */

import { describe, it, expect } from "vitest";

import { extractLoaderData } from "~/features/posts/utils/bulkposts-loader.utils";

describe("Bulk Posts Loader Utils", () => {
  describe("extractLoaderData", () => {
    it("returns empty defaults for null", () => {
      const result = extractLoaderData(null);
      expect(result.tags).toEqual([]);
      expect(result.queueTypes).toEqual([]);
      expect(result.hashTagPresets).toEqual([]);
      expect(result.mode).toBeNull();
      expect(result.groupId).toBeNull();
      expect(result.bulkDraftGroupPosts).toEqual([]);
    });

    it("returns empty defaults for undefined", () => {
      const result = extractLoaderData(undefined);
      expect(result.tags).toEqual([]);
      expect(result.bulkDraftGroupPosts).toEqual([]);
    });

    it("returns empty defaults for non-object", () => {
      const result = extractLoaderData("string");
      expect(result.tags).toEqual([]);
    });

    it("extracts tags when present", () => {
      const result = extractLoaderData({ tags: ["a", "b"] });
      expect(result.tags).toEqual(["a", "b"]);
    });

    it("defaults tags to empty array when not array", () => {
      const result = extractLoaderData({ tags: "not-array" });
      expect(result.tags).toEqual([]);
    });

    it("extracts queueTypes when present", () => {
      const queueTypes = [{ id: "1", name: "Q1" }];
      const result = extractLoaderData({ queueTypes });
      expect(result.queueTypes).toEqual(queueTypes);
    });

    it("extracts hashTagPresets when present", () => {
      const hashTagPresets = [{ id: "1", name: "Preset", tags: "#tag" }];
      const result = extractLoaderData({ hashTagPresets });
      expect(result.hashTagPresets).toEqual(hashTagPresets);
    });

    it("extracts mode when string", () => {
      expect(extractLoaderData({ mode: "edit" }).mode).toBe("edit");
      expect(extractLoaderData({ mode: 123 }).mode).toBeNull();
    });

    it("extracts groupId when string", () => {
      expect(extractLoaderData({ groupId: "g-1" }).groupId).toBe("g-1");
      expect(extractLoaderData({ groupId: 123 }).groupId).toBeNull();
    });

    it("extracts bulkDraftGroupPosts when array", () => {
      const bulkDraftGroupPosts = [
        {
          id: "1",
          caption: "Cap",
          fileUrl: ["url"],
          queueTypeId: "q1",
          queueType: { name: "Q" },
          scheduledAtUtc: null,
          isRecyclable: false,
        },
      ];
      const result = extractLoaderData({ bulkDraftGroupPosts });
      expect(result.bulkDraftGroupPosts).toEqual(bulkDraftGroupPosts);
    });

    it("defaults bulkDraftGroupPosts to empty when not array", () => {
      const result = extractLoaderData({ bulkDraftGroupPosts: "not-array" });
      expect(result.bulkDraftGroupPosts).toEqual([]);
    });

    it("extracts full object", () => {
      const data = {
        tags: ["t1"],
        queueTypes: [{ id: "1", name: "Q" }],
        hashTagPresets: [{ id: "1", name: "P", tags: "#x" }],
        mode: "create",
        groupId: "g1",
        bulkDraftGroupPosts: [],
      };
      const result = extractLoaderData(data);
      expect(result.tags).toEqual(data.tags);
      expect(result.queueTypes).toEqual(data.queueTypes);
      expect(result.hashTagPresets).toEqual(data.hashTagPresets);
      expect(result.mode).toBe("create");
      expect(result.groupId).toBe("g1");
      expect(result.bulkDraftGroupPosts).toEqual([]);
    });
  });
});
