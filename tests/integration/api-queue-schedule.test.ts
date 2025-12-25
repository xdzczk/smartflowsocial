/**
 * Integration tests for queue schedule API route
 * 
 * Tests the API endpoint in app/routes/api.queue-schedule.tsx
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { json } from "@remix-run/node";

// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getQueueTypes: vi.fn(),
  getUserTimezone: vi.fn(),
  getQueueTypeByIdForUser: vi.fn(),
}));

vi.mock("~/features/posts/schedulers", () => ({
  calculateNextScheduleTime: vi.fn(),
  formatScheduleTimeForInput: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { getQueueTypes, getUserTimezone, getQueueTypeByIdForUser } from "~/models/user.server";
import { calculateNextScheduleTime, formatScheduleTimeForInput } from "~/features/posts/schedulers";
import { action } from "~/routes/api.queue-schedule";
import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Queue Schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
    (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue("America/New_York");
  });

  describe("Successful Requests", () => {
    it("should calculate schedule time using queueTypeId", async () => {
      const mockQueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T10:00";

      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueType);
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(mockNextTime);
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(formattedTime);

      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeId: "queue-1" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(getQueueTypeByIdForUser).toHaveBeenCalledWith(TEST_USER_ID, "queue-1");
      expect(calculateNextScheduleTime).toHaveBeenCalledWith({
        queueType: mockQueueType,
        userId: TEST_USER_ID,
        userTimezone: "America/New_York",
      });
      expect(formatScheduleTimeForInput).toHaveBeenCalledWith(
        mockNextTime,
        "America/New_York",
      );
      expect(data).toEqual({
        success: true,
        scheduledTime: formattedTime,
      });
    });

    it("should calculate schedule time using queueTypeName (backward compatibility)", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "posts",
          scheduleType: "INTERVAL",
          scheduleConfig: { intervalHours: 4 },
        },
      ];

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T10:00";

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(mockNextTime);
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(formattedTime);

      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "posts" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({
        success: true,
        scheduledTime: formattedTime,
      });
    });

    it("should return empty string for unassigned queue type", async () => {
      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "unassigned" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(getQueueTypes).not.toHaveBeenCalled();
      expect(calculateNextScheduleTime).not.toHaveBeenCalled();
      expect(data).toEqual({ scheduledTime: "" });
    });

    it("should use UTC timezone when user timezone is null", async () => {
      (getUserTimezone as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const mockQueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T14:00";

      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueType);
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(mockNextTime);
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(formattedTime);

      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeId: "queue-1" }),
      });

      await action({ request, params: {}, context: {} });

      expect(calculateNextScheduleTime).toHaveBeenCalledWith({
        queueType: mockQueueType,
        userId: TEST_USER_ID,
        userTimezone: "UTC",
      });
      expect(formatScheduleTimeForInput).toHaveBeenCalledWith(mockNextTime, "UTC");
    });

    it("should prefer queueTypeId over queueTypeName", async () => {
      const mockQueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };

      const mockNextTime = new Date("2024-01-15T14:00:00Z");
      const formattedTime = "2024-01-15T10:00";

      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueType);
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockResolvedValue(mockNextTime);
      (formatScheduleTimeForInput as ReturnType<typeof vi.fn>).mockReturnValue(formattedTime);

      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueTypeId: "queue-1",
          queueTypeName: "posts",
        }),
      });

      await action({ request, params: {}, context: {} });

      expect(getQueueTypeByIdForUser).toHaveBeenCalled();
      expect(getQueueTypes).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should reject non-POST methods", async () => {
      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "GET",
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should require authentication", async () => {
      (requireUserId as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Authentication required"),
      );

      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "posts" }),
      });

      await expect(action({ request, params: {}, context: {} })).rejects.toThrow(
        "Authentication required",
      );
    });

    it("should return validation error for invalid JSON", async () => {
      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("should return NotFoundError when queue type not found", async () => {
      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(null);

      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeId: "nonexistent" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should handle scheduling calculation errors", async () => {
      const mockQueueType = {
        id: "queue-1",
        name: "posts",
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 4 },
      };

      (getQueueTypeByIdForUser as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueType);
      (calculateNextScheduleTime as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Scheduling error"),
      );

      const request = new Request("http://localhost:3000/api/queue-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeId: "queue-1" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data.success).toBe(false);
    });
  });
});

