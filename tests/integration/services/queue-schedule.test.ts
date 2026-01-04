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

vi.mock("~/features/posts/schedulers", () => ({
  calculateNextScheduleTime: vi.fn(),
  formatScheduleTimeForInput: vi.fn(),
}));

import {
  calculateNextScheduleTime,
  formatScheduleTimeForInput,
} from "~/features/posts/schedulers";
import {
  calculateQueueScheduleTime,
  parseQueueScheduleRequest,
} from "~/features/posts/services/queue-schedule.server";
import {
  getQueueTypes,
  getUserTimezone,
  getQueueTypeByIdForUser,
} from "~/features/user";
import { NotFoundError, ValidationError } from "~/lib/errors";

import { TEST_USER_ID } from "../../utils/test-helpers";

describe("Queue Schedule Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateQueueScheduleTime", () => {
    it("should return empty scheduledTime for 'unassigned' queue type", async () => {
      const result = await calculateQueueScheduleTime(
        TEST_USER_ID,
        "unassigned",
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

    it("should return empty scheduledTime when no queue type provided", async () => {
      const result = await calculateQueueScheduleTime(TEST_USER_ID);

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
        "America/New_York",
      );
      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType,
      );
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNextTime,
      );
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(
        formattedTime,
      );

      const result = await calculateQueueScheduleTime(
        TEST_USER_ID,
        undefined,
        "queue-1",
      );

      expect(getUserTimezone).toHaveBeenCalledWith(TEST_USER_ID);
      expect(getQueueTypeByIdForUser).toHaveBeenCalledWith(
        TEST_USER_ID,
        "queue-1",
      );
      expect(calculateNextScheduleTime).toHaveBeenCalledWith({
        queueType: mockQueueType,
        userId: TEST_USER_ID,
        userTimezone: "America/New_York",
      });
      expect(formatScheduleTimeForInput).toHaveBeenCalledWith(
        mockNextTime,
        "America/New_York",
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
      expect(jsonResult).toEqual({
        success: true,
        data: {
          scheduledTime: formattedTime,
        },
      });
    });

    it("should calculate schedule time using queueTypeName (backward compatibility)", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "Morning",
          scheduleType: "INTERVAL",
          scheduleConfig: { intervalHours: 4 },
        },
      ];

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T10:00";

      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue("UTC");
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueTypes,
      );
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNextTime,
      );
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(
        formattedTime,
      );

      const result = await calculateQueueScheduleTime(TEST_USER_ID, "Morning");

      expect(getUserTimezone).toHaveBeenCalledWith(TEST_USER_ID);
      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(calculateNextScheduleTime).toHaveBeenCalledWith({
        queueType: mockQueueTypes[0],
        userId: TEST_USER_ID,
        userTimezone: "UTC",
      });

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
      expect(jsonResult).toEqual({
        success: true,
        data: {
          scheduledTime: formattedTime,
        },
      });
    });

    it("should throw NotFoundError if queue type not found by ID", async () => {
      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue("UTC");
      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        null,
      );

      await expect(
        calculateQueueScheduleTime(TEST_USER_ID, undefined, "non-existent"),
      ).rejects.toThrow(NotFoundError);
    });

    it("should throw NotFoundError if queue type not found by name", async () => {
      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue("UTC");
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await expect(
        calculateQueueScheduleTime(TEST_USER_ID, "NonExistent"),
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
        mockQueueType,
      );
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNextTime,
      );
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(
        formattedTime,
      );

      await calculateQueueScheduleTime(TEST_USER_ID, undefined, "queue-1");

      expect(calculateNextScheduleTime).toHaveBeenCalledWith({
        queueType: mockQueueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
      });
      expect(formatScheduleTimeForInput).toHaveBeenCalledWith(
        mockNextTime,
        "UTC",
      );
    });

    it("should prioritize queueTypeId over queueTypeName", async () => {
      const mockQueueType = {
        id: "queue-1",
        name: "Morning",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T10:00";

      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue(
        "America/New_York",
      );
      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockQueueType,
      );
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(
        mockNextTime,
      );
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(
        formattedTime,
      );

      await calculateQueueScheduleTime(TEST_USER_ID, "Evening", "queue-1");

      expect(getQueueTypeByIdForUser).toHaveBeenCalledWith(
        TEST_USER_ID,
        "queue-1",
      );
      expect(getQueueTypes).not.toHaveBeenCalled();
    });
  });

  describe("parseQueueScheduleRequest", () => {
    it("should parse valid request body with queueTypeName", () => {
      const body = { queueTypeName: "Morning" };
      const result = parseQueueScheduleRequest(body);

      expect(result).toEqual({
        queueTypeName: "Morning",
        queueTypeId: undefined,
      });
    });

    it("should parse valid request body with queueTypeId", () => {
      const body = { queueTypeId: "queue-123" };
      const result = parseQueueScheduleRequest(body);

      expect(result).toEqual({
        queueTypeName: undefined,
        queueTypeId: "queue-123",
      });
    });

    it("should parse valid request body with both", () => {
      const body = { queueTypeName: "Morning", queueTypeId: "queue-123" };
      const result = parseQueueScheduleRequest(body);

      expect(result).toEqual({
        queueTypeName: "Morning",
        queueTypeId: "queue-123",
      });
    });

    it("should throw ValidationError for null body", () => {
      expect(() => parseQueueScheduleRequest(null)).toThrow(ValidationError);
    });

    it("should throw ValidationError for non-object body", () => {
      expect(() => parseQueueScheduleRequest("string")).toThrow(
        ValidationError,
      );
      expect(() => parseQueueScheduleRequest(123)).toThrow(ValidationError);
    });

    it("should handle empty object", () => {
      const result = parseQueueScheduleRequest({});

      expect(result).toEqual({
        queueTypeName: undefined,
        queueTypeId: undefined,
      });
    });
  });
});
