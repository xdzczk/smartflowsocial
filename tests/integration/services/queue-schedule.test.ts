/**
 * Integration tests for queue schedule service
 * Tests app/features/posts/services/queue-schedule.server.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/user", () => ({
  getQueueTypes: vi.fn(),
  getUserTimezone: vi.fn(),
  getQueueTypeByIdForUser: vi.fn(),
}));

vi.mock("~/features/posts/scheduling/services/schedulers", () => ({
  calculateNextScheduleTime: vi.fn(),
  formatScheduleTimeForInput: vi.fn(),
}));

import { TEST_USER_ID } from "../../utils/test-helpers";

import {
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
  calculateQueueScheduleTime,
  parseQueueScheduleRequest,
} from "~/features/posts/server/scheduling";
import { getUserTimezone, getQueueTypeByIdForUser } from "~/features/user";
import { NotFoundError, ValidationError } from "~/lib/errors";

describe("Queue Schedule Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateQueueScheduleTime", () => {
    it("should return empty scheduledTime for 'unassigned' queue type", async () => {
      const result = await calculateQueueScheduleTime(
        TEST_USER_ID,
        "unassigned"
      );

      expect(getUserTimezone).not.toHaveBeenCalled();
      const response =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await response.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { scheduledTime?: string; error?: string })
          : {};
      expect(jsonResult).toEqual({ scheduledTime: "" });
    });

    it("should calculate schedule time using queueTypeId", async () => {
      const mockQueueType = {
        id: "queue-1",
        name: "Morning",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T10:00";

      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue(
        "America/New_York"
      );
      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType
      );
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNextTime
      );
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(
        formattedTime
      );

      const result = await calculateQueueScheduleTime(TEST_USER_ID, "queue-1");

      expect(getUserTimezone).toHaveBeenCalledWith(TEST_USER_ID);
      expect(getQueueTypeByIdForUser).toHaveBeenCalledWith(
        TEST_USER_ID,
        "queue-1"
      );
      expect(calculateNextScheduleTime).toHaveBeenCalledWith({
        queueType: mockQueueType,
        userId: TEST_USER_ID,
        userTimezone: "America/New_York",
      });
      expect(formatScheduleTimeForInput).toHaveBeenCalledWith(
        mockNextTime,
        "America/New_York"
      );

      const response =
        result instanceof Response
          ? result
          : new Response(JSON.stringify(result));
      const jsonResultRaw: unknown = await response.json();
      const jsonResult =
        jsonResultRaw &&
        typeof jsonResultRaw === "object" &&
        !Array.isArray(jsonResultRaw)
          ? (jsonResultRaw as { scheduledTime?: string; error?: string })
          : {};
      expect(jsonResult).toEqual({ scheduledTime: formattedTime });
    });

    it("should throw NotFoundError if queue type not found by ID", async () => {
      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue("UTC");
      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        null
      );

      await expect(
        calculateQueueScheduleTime(TEST_USER_ID, "non-existent")
      ).rejects.toThrow(NotFoundError);
    });

    it("should use UTC timezone if user timezone is null", async () => {
      const mockQueueType = {
        id: "queue-1",
        name: "Morning",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T14:00";

      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType
      );
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNextTime
      );
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(
        formattedTime
      );

      await calculateQueueScheduleTime(TEST_USER_ID, "queue-1");

      expect(calculateNextScheduleTime).toHaveBeenCalledWith({
        queueType: mockQueueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
      });
      expect(formatScheduleTimeForInput).toHaveBeenCalledWith(
        mockNextTime,
        "UTC"
      );
    });
  });

  describe("parseQueueScheduleRequest", () => {
    it("should parse valid request body with queueTypeId", () => {
      const body = { queueTypeId: "queue-123" };
      const result = parseQueueScheduleRequest(body);

      expect(result).toEqual({ queueTypeId: "queue-123" });
    });

    it("should trim queueTypeId", () => {
      const result = parseQueueScheduleRequest({
        queueTypeId: "  queue-123  ",
      });
      expect(result).toEqual({ queueTypeId: "queue-123" });
    });

    it("should throw ValidationError for null body", () => {
      expect(() => parseQueueScheduleRequest(null)).toThrow(ValidationError);
    });

    it("should throw ValidationError for non-object body", () => {
      expect(() => parseQueueScheduleRequest("string")).toThrow(
        ValidationError
      );
      expect(() => parseQueueScheduleRequest(123)).toThrow(ValidationError);
    });

    it("should throw ValidationError when queueTypeId is missing", () => {
      expect(() => parseQueueScheduleRequest({})).toThrow(ValidationError);
      expect(() => parseQueueScheduleRequest({ queueTypeId: "" })).toThrow(
        ValidationError
      );
    });
  });
});
