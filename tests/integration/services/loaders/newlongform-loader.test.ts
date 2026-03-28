/**
 * Integration tests for new longform loader
 * Tests app/features/posts/services/newlongform-loader.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/payments/subscriptions.server", () => ({
  requireFeatureAccess: vi.fn(),
}));

vi.mock("~/features/user", () => ({
  getUserById: vi.fn(),
  getScheduleInterval: vi.fn(),
  getQueueTypes: vi.fn(),
  getUserHashTagPresets: vi.fn(),
  getUserUploadProvider: vi.fn(),
}));

vi.mock("~/features/templates/services/template-data.server", () => ({
  getTemplates: vi.fn().mockResolvedValue([]),
  getTemplatePrefill: vi.fn().mockResolvedValue(null),
}));

vi.mock("~/features/relays/relay-resolution.server", () => ({
  resolveExecutionRelays: vi.fn(),
}));

import { TEST_USER_ID } from "../../../utils/test-helpers";

import { requireFeatureAccess } from "~/features/payments/subscriptions.server";
import { loadNewLongFormData } from "~/features/posts/server/longform";
import { resolveExecutionRelays } from "~/features/relays/relay-resolution.server";
import {
  getUserById,
  getScheduleInterval,
  getQueueTypes,
  getUserHashTagPresets,
  getUserUploadProvider,
} from "~/features/user";

describe("New Longform Loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load new longform data", async () => {
    const mockTags = "tag1 tag2 tag3";
    const mockUser = { id: TEST_USER_ID, timezone: "America/New_York" };
    const mockScheduleIntervals = ["4", "6", "8"];
    const mockQueueTypes = [{ id: "queue-1", name: "Queue 1" }];
    const mockHashTagPresets = [{ id: "preset-1", name: "Preset 1" }];
    const mockUploadProvider = "s3";
    const mockRelays = ["wss://relay.example.com"];

    (resolveExecutionRelays as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockRelays
    );
    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockScheduleIntervals
    );
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockQueueTypes
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: mockTags },
      ...mockHashTagPresets,
    ]);
    (getUserUploadProvider as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockUploadProvider
    );

    const result = await loadNewLongFormData(TEST_USER_ID);

    expect(requireFeatureAccess).toHaveBeenCalledWith(
      TEST_USER_ID,
      "longformPosts"
    );
    expect(result.userId).toBe(TEST_USER_ID);
    expect(result.tags).toBe(mockTags);
    expect(result.scheduleIntervals).toEqual(mockScheduleIntervals);
    expect(result.queueTypes).toEqual(mockQueueTypes);
    expect(result.hashTagPresets).toEqual([
      { id: "preset-1", name: "Default", tags: mockTags },
      ...mockHashTagPresets,
    ]);
    expect(result.userTimezone).toBe("America/New_York");
    expect(result.uploadProvider).toBe(mockUploadProvider);
    expect(result.relays).toEqual(mockRelays);
  });

  it("should use default timezone if user timezone is missing", async () => {
    const mockUser = { id: TEST_USER_ID };

    (requireFeatureAccess as ReturnType<typeof vi.fn>).mockResolvedValue(
      undefined
    );
    (getUserHashTagPresets as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: "preset-1", name: "Default", tags: "" },
    ]);
    (getUserById as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser);
    (getScheduleInterval as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (getUserUploadProvider as ReturnType<typeof vi.fn>).mockResolvedValue("s3");
    (resolveExecutionRelays as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await loadNewLongFormData(TEST_USER_ID);

    expect(result.userTimezone).toBe("Etc/GMT");
  });
});
