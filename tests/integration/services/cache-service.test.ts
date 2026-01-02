/**
 * Integration tests for Primal cache service
 * Tests app/features/cache/primalCache.server.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock dependencies
vi.mock("~/lib/error-logger.server", () => ({
  logError: vi.fn(),
}));

// Mock global fetch
global.fetch = vi.fn();

import { fetchFromCache, connectToPrimalCache } from "~/features/cache/primalCache.server";
import { logError } from "~/lib/error-logger.server";

describe("Primal Cache Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PRIMAL_CACHING_URL = "https://cache.example.com/api";
  });

  afterEach(() => {
    delete process.env.PRIMAL_CACHING_URL;
  });

  describe("fetchFromCache", () => {
    it("should fetch data successfully", async () => {
      const mockResponse = [{ id: "event-123", content: "test" }];
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchFromCache("thread_view", { event_id: "event-123" });

      expect(global.fetch).toHaveBeenCalledWith("https://cache.example.com/api", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "thread_view",
          params: { event_id: "event-123" },
        }),
      });
      expect(result).toEqual(mockResponse);
    });

    it("should retry on 502 error", async () => {
      const mockResponse = [{ id: "event-123", content: "test" }];
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

      vi.useFakeTimers();
      const promise = fetchFromCache("thread_view", { event_id: "event-123" }, 2);

      // Fast-forward through retry delay
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      vi.useRealTimers();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResponse);
    });

    it("should retry on 503 error", async () => {
      const mockResponse = [{ id: "event-123", content: "test" }];
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        });

      vi.useFakeTimers();
      const promise = fetchFromCache("thread_view", { event_id: "event-123" }, 2);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      vi.useRealTimers();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockResponse);
    });

    it("should throw error if PRIMAL_CACHING_URL is not set", async () => {
      delete process.env.PRIMAL_CACHING_URL;

      await expect(fetchFromCache("thread_view", { event_id: "event-123" })).rejects.toThrow(
        "PRIMAL_CACHING_URL environment variable is not set",
      );
    });

    it("should throw error after max retries", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(fetchFromCache("thread_view", { event_id: "event-123" }, 1)).rejects.toThrow(
        "HTTP error! status: 500",
      );
    });

    it("should handle network errors with retries", async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve([{ id: "event-123" }]),
        });

      vi.useFakeTimers();
      const promise = fetchFromCache("thread_view", { event_id: "event-123" }, 2);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await promise;
      vi.useRealTimers();

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual([{ id: "event-123" }]);
    });

    it("should throw error after all retries exhausted", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

      vi.useFakeTimers();
      const promise = fetchFromCache("thread_view", { event_id: "event-123" }, 1);

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      await expect(promise).rejects.toThrow("Network error");
      vi.useRealTimers();
    });
  });

  describe("connectToPrimalCache", () => {
    it("should return responses with non-EOSE events", async () => {
      const mockResponse = [
        [{ id: "event-1" }],
        [{ id: "event-2" }],
        ["EOSE"],
      ];
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await connectToPrimalCache("thread_view", { event_id: "event-123" });

      expect(result).toEqual(mockResponse);
      expect(logError).not.toHaveBeenCalled();
    });

    it("should throw error for empty response (only EOSE)", async () => {
      const mockResponse = [["EOSE"]];
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      await expect(connectToPrimalCache("thread_view", { event_id: "event-123" })).rejects.toThrow(
        "Primal cache gave empty response.",
      );
      expect(logError).toHaveBeenCalled();
    });

    it("should throw error for completely empty response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });

      await expect(connectToPrimalCache("thread_view", { event_id: "event-123" })).rejects.toThrow(
        "Primal cache gave empty response.",
      );
    });

    it("should handle fetch errors and log them", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Fetch failed"));

      await expect(connectToPrimalCache("thread_view", { event_id: "event-123" })).rejects.toThrow("Fetch failed");
      expect(logError).toHaveBeenCalled();
    });

    it("should handle non-array responses", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: "Invalid response" }),
      });

      await expect(connectToPrimalCache("thread_view", { event_id: "event-123" })).rejects.toThrow();
    });
  });
});

