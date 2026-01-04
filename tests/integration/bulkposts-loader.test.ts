/**
 * Integration tests for bulk posts loader
 *
 * Tests app/routes/dashboard.bulkposts.tsx loader
 * Tests getBulkPostsDashboardData function
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
// Mock Prisma to prevent $use errors
vi.mock("~/lib/prisma.server", () => ({
  prisma: {
    $use: vi.fn(),
    hashTagPreset: {
      findFirst: vi.fn(),
    },
    queueType: {
      count: vi.fn(),
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Mock dependencies - mock the actual module being used
vi.mock("~/features/user", () => ({
  getQueueTypes: vi.fn(),
  getUserHashTags: vi.fn(),
  getUserHashTagPresets: vi.fn(),
}));

import { getBulkPostsDashboardData } from "~/features/posts/server";
import {
  getQueueTypes,
  getUserHashTags,
  getUserHashTagPresets,
} from "~/features/user";

import { TEST_USER_ID, createMockQueueType } from "../utils/test-helpers";

describe("Bulk Posts Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load bulk posts dashboard data", async () => {
    const mockTags = "#tag1 #tag2 #tag3";
    const mockQueueTypes = [
      createMockQueueType({ id: "queue-1", name: "posts" }),
      createMockQueueType({ id: "queue-2", name: "all" }),
    ];
    const mockHashTagPresets = [
      { id: "preset-1", name: "Default", hashtags: "#default #tags" },
      { id: "preset-2", name: "Custom", hashtags: "#custom #hashtags" },
    ];

    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(mockTags);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes,
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockHashTagPresets,
    );

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(getUserHashTags).toHaveBeenCalledWith(TEST_USER_ID);
    expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
    expect(getUserHashTagPresets).toHaveBeenCalledWith(TEST_USER_ID);

    expect(result.tags).toEqual(["#tag1", "#tag2", "#tag3"]);
    expect(result.queueTypes).toEqual(
      mockQueueTypes.filter((qt) => qt.isEnabled !== false),
    );
    expect(result.hashTagPresets).toEqual(mockHashTagPresets);
    expect(result.mode).toBe("preset"); // Has presets, so mode is "preset"
  });

  it("should set mode to 'manual' when no hash tag presets exist", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(
      "#tag1 #tag2",
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.mode).toBe("manual");
  });

  it("should sort tags alphabetically", async () => {
    const unsortedTags = "#zebra #apple #banana";
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(
      unsortedTags,
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["#apple", "#banana", "#zebra"]);
  });

  it("should filter out empty tags", async () => {
    const tagsWithSpaces = "#tag1   #tag2  #tag3";
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(
      tagsWithSpaces,
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual(["#tag1", "#tag2", "#tag3"]);
    expect(result.tags.every((tag) => tag.trim().length > 0)).toBe(true);
  });

  it("should handle null or empty tags", async () => {
    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.tags).toEqual([]);
  });

  it("should filter out disabled queue types", async () => {
    const mockQueueTypes = [
      createMockQueueType({ id: "queue-1", name: "posts", isEnabled: true }),
      createMockQueueType({
        id: "queue-2",
        name: "disabled",
        isEnabled: false,
      }),
      createMockQueueType({ id: "queue-3", name: "enabled", isEnabled: true }),
    ];

    (getUserHashTags as ReturnType<typeof vi.fn>).mockResolvedValue("");
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes,
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await getBulkPostsDashboardData(TEST_USER_ID);

    expect(result.queueTypes).toHaveLength(2);
    expect(result.queueTypes.every((qt) => qt.isEnabled !== false)).toBe(true);
  });
});
