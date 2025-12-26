/**
 * Integration tests for effective hashtags API route
 * 
 * Tests the API endpoint in app/routes/api.effective-hashtags.tsx
 */

import { json } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies
vi.mock("~/features/auth/session.server", () => ({
  requireUserId: vi.fn(),
}));

vi.mock("~/models/user.server", () => ({
  getQueueTypes: vi.fn(),
}));

import { requireUserId } from "~/features/auth/session.server";
import { getQueueTypes } from "~/models/user.server";
import { action } from "~/routes/api.effective-hashtags";

import { TEST_USER_ID } from "../utils/test-helpers";

describe("API: Effective Hashtags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireUserId as ReturnType<typeof vi.fn>).mockResolvedValue(TEST_USER_ID);
  });

  describe("Successful Requests", () => {
    it("should return hashtags for queue type with hashtag preset", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: {
            id: "preset-1",
            tags: "#marketing #social #growth",
          },
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "posts" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(requireUserId).toHaveBeenCalledWith(request);
      expect(getQueueTypes).toHaveBeenCalledWith(TEST_USER_ID);
      expect(data).toEqual({
        hashtags: "#marketing #social #growth",
      });
    });

    it("should return hashtags using queueTypeId", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: {
            id: "preset-1",
            tags: "#custom #tags",
          },
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeId: "queue-1" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data).toEqual({
        hashtags: "#custom #tags",
      });
    });

    it("should prefer queueTypeId over queueTypeName", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: {
            id: "preset-1",
            tags: "#id-tags",
          },
        },
        {
          id: "queue-2",
          name: "posts",
          hashTagPreset: {
            id: "preset-2",
            tags: "#name-tags",
          },
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueTypeId: "queue-1",
          queueTypeName: "posts",
        }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data.hashtags).toBe("#id-tags");
    });

    it("should return empty string for unassigned queue type", async () => {
      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "unassigned" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(getQueueTypes).not.toHaveBeenCalled();
      expect(data).toEqual({ hashtags: "" });
    });

    it("should return empty string when queue type has no hashtag preset", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: null,
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "posts" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data).toEqual({ hashtags: "" });
    });

    it("should return empty string when queue type not found", async () => {
      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "nonexistent" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data).toEqual({ hashtags: "" });
    });

    it("should handle null tags in hashtag preset", async () => {
      const mockQueueTypes = [
        {
          id: "queue-1",
          name: "posts",
          hashTagPreset: {
            id: "preset-1",
            tags: null,
          },
        },
      ];

      (getQueueTypes as ReturnType<typeof vi.fn>).mockResolvedValue(mockQueueTypes);

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "posts" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(data).toEqual({ hashtags: "" });
    });
  });

  describe("Error Handling", () => {
    it("should require authentication", async () => {
      // requireUserId throws a Response (redirect), not an Error
      const redirectResponse = new Response(null, {
        status: 302,
        headers: { Location: "/login" },
      });
      (requireUserId as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw redirectResponse;
      });

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "posts" }),
      });

      const response = await action({ request, params: {}, context: {} });
      // Response should be rethrown by error handler, so we should get a redirect
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/login");
    });

    it("should return validation error for invalid JSON", async () => {
      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should return validation error when neither queueTypeName nor queueTypeId provided", async () => {
      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it("should handle database errors gracefully", async () => {
      (getQueueTypes as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Database error"),
      );

      const request = new Request("http://localhost:3000/api/effective-hashtags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queueTypeName: "posts" }),
      });

      const response = await action({ request, params: {}, context: {} });
      const data = await response.json();

      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(data.success).toBe(false);
    });
  });
});

