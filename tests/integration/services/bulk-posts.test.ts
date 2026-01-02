/**
 * Integration tests for bulk posts service
 * Tests app/features/posts/services/bulk-posts.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  getUserHashTags: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

import { getBulkPostsDashboardData } from "~/features/posts/services/bulk-posts.server";
import { getUserHashTags, getQueueTypes, getUserHashTagPresets } from "~/features/user";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Bulk Posts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return dashboard data with tags, queue types, and presets", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("tag1 tag2 tag3");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
      { id: "queue-3", name: "Queue 3", isEnabled: true },
    ]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Preset 1" },
    ]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
    expect(result.queueTypes).toHaveLength(2); // Only enabled ones
    expect(result.queueTypes[0].id).toBe("queue-1");
    expect(result.queueTypes[1].id).toBe("queue-3");
    expect(result.hashTagPresets).toHaveLength(1);
    expect(result.mode).toBe("preset");
  });

  it("should set mode to 'manual' when no hash tag presets exist", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("tag1 tag2");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.mode).toBe("manual");
    expect(result.hashTagPresets).toEqual([]);
  });

  it("should sort tags alphabetically", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("zebra apple banana");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["apple", "banana", "zebra"]);
  });

  it("should filter out empty tags", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("tag1   tag2  tag3");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("should handle empty tags string", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual([]);
  });

  it("should handle non-string tags by converting to string", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(123);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    // The code converts non-string to string, so 123 becomes "123"
    expect(result.tags).toEqual(["123"]);
  });

  it("should filter out disabled queue types", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
      { id: "queue-3", name: "Queue 3", isEnabled: true },
      { id: "queue-4", name: "Queue 4" }, // Missing isEnabled
    ]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.queueTypes).toHaveLength(2);
    expect(result.queueTypes[0].id).toBe("queue-1");
    expect(result.queueTypes[1].id).toBe("queue-3");
  });

  it("should handle non-array queue types", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue("not-an-array");
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.queueTypes).toEqual([]);
  });

  it("should handle non-array hash tag presets", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue("not-an-array");

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.hashTagPresets).toEqual([]);
    expect(result.mode).toBe("manual");
  });
});

