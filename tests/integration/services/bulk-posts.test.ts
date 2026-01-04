/**
 * Integration tests for bulk posts service
 * Tests app/features/posts/services/bulk-posts.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

import { getBulkPostsDashboardData } from "~/features/posts/services/bulk-posts.server";
import {
  getQueueTypes,
  getUserHashTagPresets,
} from "~/features/user";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Bulk Posts Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return dashboard data with tags, queue types, and presets", async () => {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "queue-1", name: "Queue 1", isEnabled: true },
      { id: "queue-2", name: "Queue 2", isEnabled: false },
      { id: "queue-3", name: "Queue 3", isEnabled: true },
    ]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: "tag1 tag2 tag3" },
      { id: "preset-2", name: "Preset 1" },
    ]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
    expect(result.queueTypes).toHaveLength(2); // Only enabled ones
    expect(result.queueTypes[0].id).toBe("queue-1");
    expect(result.queueTypes[1].id).toBe("queue-3");
    expect(result.hashTagPresets).toHaveLength(2); // All presets are returned
    expect(result.mode).toBe("preset");
  });

  it("should set mode to 'manual' when no hash tag presets exist", async () => {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.mode).toBe("manual");
    expect(result.hashTagPresets).toEqual([]);
  });

  it("should sort tags alphabetically", async () => {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: "zebra apple banana" },
    ]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["apple", "banana", "zebra"]);
  });

  it("should filter out empty tags", async () => {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: "tag1   tag2  tag3" },
    ]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("should handle empty tags string", async () => {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: "" },
    ]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual([]);
  });

  it("should handle empty default preset", async () => {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Custom", tags: "custom tags" },
    ]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    // No Default preset, so tags should be empty
    expect(result.tags).toEqual([]);
  });

  it("should filter out disabled queue types", async () => {
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
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      "not-an-array",
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.queueTypes).toEqual([]);
  });

  it("should handle non-array hash tag presets", async () => {
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(
      "not-an-array",
    );

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.hashTagPresets).toEqual([]);
    expect(result.mode).toBe("manual");
  });
});
