/**
 * Unit tests for giveaway display (scope summary, status label, queue resolution).
 * Tests app/features/giveaway/giveaway-display.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindQueueTypeNameByIdAndUser = vi.fn();
const mockFindQueueTypesByIdsAndUser = vi.fn();

vi.mock(
  "~/features/giveaway/repositories/giveaway-display-data.server",
  () => ({
    findQueueTypeNameByIdAndUser: (...args: unknown[]) =>
      mockFindQueueTypeNameByIdAndUser(...args),
    findQueueTypesByIdsAndUser: (...args: unknown[]) =>
      mockFindQueueTypesByIdsAndUser(...args),
  })
);

import {
  formatScopeSummaryLabel,
  formatStatusLabel,
  resolveGiveawayQueueName,
  getQueueNamesByIds,
} from "~/features/giveaway/giveaway-display.server";

describe("giveaway-display", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("formatScopeSummaryLabel", () => {
    it("PERIOD: Last N days when only days", () => {
      expect(formatScopeSummaryLabel("PERIOD", { days: 14 })).toBe(
        "Last 14 days"
      );
      expect(formatScopeSummaryLabel("PERIOD", {})).toBe("Last 7 days");
    });

    it("PERIOD: date range when from/to set", () => {
      const label = formatScopeSummaryLabel("PERIOD", {
        from: "2025-03-01",
        to: "2025-03-07",
      });
      expect(label).toContain("Mar");
      expect(label).toContain("1");
      expect(label).toContain("7");
    });

    it("PERIOD: appends queue name when provided", () => {
      expect(formatScopeSummaryLabel("PERIOD", { days: 7 }, "My Queue")).toBe(
        "Last 7 days · Queue: My Queue"
      );
    });

    it("SINGLE_POST: Single post", () => {
      expect(formatScopeSummaryLabel("SINGLE_POST", { postId: "p1" })).toBe(
        "Single post"
      );
    });

    it("QUEUE: Queue or Queue: name", () => {
      expect(formatScopeSummaryLabel("QUEUE", {}, null)).toBe("Queue");
      expect(formatScopeSummaryLabel("QUEUE", {}, "Feed")).toBe("Queue: Feed");
    });

    it("FOLLOWERS / FOLLOWING", () => {
      expect(formatScopeSummaryLabel("FOLLOWERS", {})).toBe("Followers");
      expect(formatScopeSummaryLabel("FOLLOWING", {})).toBe("Following");
    });
  });

  describe("formatStatusLabel", () => {
    it("maps known statuses to human label", () => {
      expect(formatStatusLabel("DRAFT")).toBe("Draft");
      expect(formatStatusLabel("PREVIEWED")).toBe("Winners preview");
      expect(formatStatusLabel("LOCKED")).toBe("Locked");
      expect(formatStatusLabel("PAID_OUT")).toBe("Paid out");
      expect(formatStatusLabel("CANCELLED")).toBe("Cancelled");
    });

    it("falls back to replacing underscores", () => {
      expect(formatStatusLabel("SOME_STATUS")).toBe("SOME STATUS");
    });
  });

  describe("resolveGiveawayQueueName", () => {
    it("returns null when scopeReference has no queueId", async () => {
      const name = await resolveGiveawayQueueName("user-1", {});
      expect(name).toBeNull();
      expect(mockFindQueueTypeNameByIdAndUser).not.toHaveBeenCalled();
    });

    it("returns queue name when queueId present and found", async () => {
      mockFindQueueTypeNameByIdAndUser.mockResolvedValue("My Queue");
      const name = await resolveGiveawayQueueName("user-1", {
        queueId: "queue-1",
      });
      expect(name).toBe("My Queue");
      expect(mockFindQueueTypeNameByIdAndUser).toHaveBeenCalledWith(
        "user-1",
        "queue-1"
      );
    });

    it("returns null when queueId not string", async () => {
      const name = await resolveGiveawayQueueName("user-1", {
        queueId: 123,
      });
      expect(name).toBeNull();
    });
  });

  describe("getQueueNamesByIds", () => {
    it("returns empty map for empty array", async () => {
      const result = await getQueueNamesByIds("user-1", []);
      expect(result).toEqual({});
      expect(mockFindQueueTypesByIdsAndUser).not.toHaveBeenCalled();
    });

    it("returns map of queueId to name", async () => {
      mockFindQueueTypesByIdsAndUser.mockResolvedValue([
        { id: "q1", name: "Queue One" },
        { id: "q2", name: "Queue Two" },
      ]);
      const result = await getQueueNamesByIds("user-1", ["q1", "q2", "q3"]);
      expect(result).toEqual({
        q1: "Queue One",
        q2: "Queue Two",
        q3: null,
      });
    });
  });
});
