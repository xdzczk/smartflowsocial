/**
 * Unit tests for bulk composer data utilities
 * Tests app/features/posts/utils/bulk-composer-data.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("~/features/posts/utils/client-id", () => ({
  createBulkPostClientId: vi.fn(() => "bulkpost_test-id"),
}));

import {
  convertRepostDataToBulkPosts,
  convertQuoteDataToBulkPosts,
  convertScheduledPostsToBulkPosts,
  loadScheduledRepostDataAsBulkPosts,
} from "~/features/posts/utils/bulk-composer-data";

describe("Bulk Composer Data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("convertRepostDataToBulkPosts", () => {
    it("converts items with caption and queueType", () => {
      const items = [
        {
          caption: "Cap",
          queueType: "queue1",
          fileUrl: "https://example.com/img.jpg",
        },
      ];
      const result = convertRepostDataToBulkPosts(items);
      expect(result).toHaveLength(1);
      expect(result[0]!.caption).toBe("Cap");
      expect(result[0]!.queueType).toBe("queue1");
      expect(result[0]!.fileUrl).toBe("https://example.com/img.jpg");
      expect(result[0]!.isRepost).toBe(true);
    });

    it("uses first URL from JSON string array fileUrl", () => {
      const items = [
        { fileUrl: '["https://a.com/1.jpg", "https://a.com/2.jpg"]' },
      ];
      const result = convertRepostDataToBulkPosts(items);
      expect(result[0]!.fileUrl).toBe("https://a.com/1.jpg");
    });

    it("uses first element from array fileUrl", () => {
      const items = [{ fileUrl: ["https://first.jpg", "https://second.jpg"] }];
      const result = convertRepostDataToBulkPosts(items);
      expect(result[0]!.fileUrl).toBe("https://first.jpg");
    });

    it("defaults optional fields", () => {
      const result = convertRepostDataToBulkPosts([{}]);
      expect(result[0]!.caption).toBe("");
      expect(result[0]!.queueType).toBe("unassigned");
      expect(result[0]!.scheduledFor).toBe("");
      expect(result[0]!.isRecyclable).toBe(false);
    });

    it("maps multiple items", () => {
      const items = [{ caption: "A" }, { caption: "B" }];
      const result = convertRepostDataToBulkPosts(items);
      expect(result).toHaveLength(2);
      expect(result[0]!.caption).toBe("A");
      expect(result[1]!.caption).toBe("B");
    });
  });

  describe("convertQuoteDataToBulkPosts", () => {
    it("converts quote items with optional fields", () => {
      const items = [
        {
          caption: "Quote cap",
          naddr: "naddr1xxx",
          originalEventId: "ev1",
          originalCaption: "Original",
          isLongformQuote: true,
        },
      ];
      const result = convertQuoteDataToBulkPosts(items);
      expect(result).toHaveLength(1);
      expect(result[0]!.caption).toBe("Quote cap");
      expect(result[0]!.isQuotePost).toBe(true);
      expect(result[0]!.naddr).toBe("naddr1xxx");
      expect(result[0]!.originalEventId).toBe("ev1");
      expect(result[0]!.originalCaption).toBe("Original");
      expect(result[0]!.originalTitle).toBe("");
      expect(result[0]!.isLongformQuote).toBe(true);
    });

    it("normalizes fileUrl from JSON string array", () => {
      const items = [{ fileUrl: '["https://one.jpg"]' }];
      const result = convertQuoteDataToBulkPosts(items);
      expect(result[0]!.fileUrl).toBe("https://one.jpg");
    });
  });

  describe("convertScheduledPostsToBulkPosts", () => {
    it("converts scheduled posts with Date scheduledAtUtc", () => {
      const scheduledAt = new Date("2025-06-15T14:00:00.000Z");
      const posts = [
        {
          id: "p1",
          caption: "Scheduled cap",
          queueType: { name: "Main" },
          scheduledAtUtc: scheduledAt,
          isRecyclable: true,
        },
      ];
      const result = convertScheduledPostsToBulkPosts(posts, "UTC");
      expect(result).toHaveLength(1);
      expect(result[0]!.caption).toBe("Scheduled cap");
      expect(result[0]!.queueType).toBe("Main");
      expect(result[0]!.isRecyclable).toBe(true);
      expect(result[0]!.scheduledFor).toContain("2025");
    });

    it("converts fileUrl array to fileUrl", () => {
      const posts = [
        {
          id: "p1",
          fileUrl: ["https://x.jpg"],
          queueType: null,
          scheduledAtUtc: null,
        },
      ];
      const result = convertScheduledPostsToBulkPosts(posts, "UTC");
      expect(result[0]!.fileUrl).toEqual(["https://x.jpg"]);
    });

    it("handles string fileUrl", () => {
      const posts = [
        {
          id: "p1",
          fileUrl: "https://single.jpg",
          queueType: null,
          scheduledAtUtc: null,
        },
      ];
      const result = convertScheduledPostsToBulkPosts(posts, "UTC");
      expect(result[0]!.fileUrl).toEqual(["https://single.jpg"]);
    });

    it("defaults queueType to unassigned when null", () => {
      const result = convertScheduledPostsToBulkPosts(
        [{ id: "p1", queueType: null, scheduledAtUtc: null }],
        "UTC"
      );
      expect(result[0]!.queueType).toBe("unassigned");
    });
  });

  describe("loadScheduledRepostDataAsBulkPosts", () => {
    it("does not call fetch when items have no originalPostId", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fetch mock
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const items = [
        { caption: "Cap", queueType: "q1", scheduledFor: "2025-01-01" },
      ];
      const result = await loadScheduledRepostDataAsBulkPosts(items);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]!.caption).toBe("Cap");
      expect(result[0]!.queueType).toBe("q1");
      expect(result[0]!.originalPostId).toBeUndefined();
      fetchSpy.mockRestore();
    });

    it("fetches batch and maps items with originalPost data (fileUrl from first element)", async () => {
      const batchResponse = [
        {
          id: "post-1",
          fileUrl: ["https://first.jpg", "https://second.jpg"],
          caption: "Original caption",
        },
      ];
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fetch mock
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(batchResponse),
      } as Response);

      const items = [
        {
          originalPostId: "post-1",
          caption: "Item cap",
          queueType: "q1",
          scheduledFor: "2025-01-01",
        },
      ];
      const result = await loadScheduledRepostDataAsBulkPosts(items);

      expect(fetchSpy).toHaveBeenCalledWith("/api/posts/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postIds: ["post-1"] }),
      });
      expect(result).toHaveLength(1);
      expect(result[0]!.fileUrl).toBe("https://first.jpg");
      expect(result[0]!.originalCaption).toBe("Original caption");
      expect(result[0]!.originalPostId).toBe("post-1");
      expect(result[0]!.isKind6Repost).toBe(true);
      fetchSpy.mockRestore();
    });

    it("returns mapped items with empty fileUrl/originalCaption when batch returns empty array", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fetch mock
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      } as Response);

      const items = [
        { originalPostId: "post-1", caption: "Cap", queueType: "q1" },
      ];
      const result = await loadScheduledRepostDataAsBulkPosts(items);

      expect(result[0]!.fileUrl).toBeUndefined();
      expect(result[0]!.originalCaption).toBe("");
      expect(result[0]!.originalPostId).toBe("post-1");
      fetchSpy.mockRestore();
    });

    it("leaves originalPosts empty on non-ok response", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fetch mock
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: false,
        json: () => Promise.resolve([]),
      } as Response);

      const items = [
        { originalPostId: "post-1", caption: "Cap", queueType: "q1" },
      ];
      const result = await loadScheduledRepostDataAsBulkPosts(items);

      expect(result[0]!.originalCaption).toBe("");
      expect(result[0]!.fileUrl).toBeUndefined();
      fetchSpy.mockRestore();
    });

    it("leaves originalPosts empty when fetch throws (network error)", async () => {
      const fetchSpy = vi
        .spyOn(global, "fetch")
        .mockRejectedValue(new Error("Network error"));

      const items = [
        { originalPostId: "post-1", caption: "Cap", queueType: "q1" },
      ];
      const result = await loadScheduledRepostDataAsBulkPosts(items);

      expect(result[0]!.originalCaption).toBe("");
      expect(result[0]!.fileUrl).toBeUndefined();
      expect(result).toHaveLength(1);
      fetchSpy.mockRestore();
    });

    it("uses string fileUrl from originalPost when not array", async () => {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal fetch mock
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve([
            { id: "p1", fileUrl: "https://single.jpg", caption: "Cap" },
          ]),
      } as Response);

      const items = [{ originalPostId: "p1", caption: "Item" }];
      const result = await loadScheduledRepostDataAsBulkPosts(items);

      expect(result[0]!.fileUrl).toBe("https://single.jpg");
      fetchSpy.mockRestore();
    });
  });
});
