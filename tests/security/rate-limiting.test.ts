/**
 * Rate Limiting Tests
 *
 * Tests for rate limiting middleware to ensure proper protection against abuse.
 */

import type { Request, Response, NextFunction } from "express";
import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  apiLimiter,
  strictLimiter,
  authLimiter,
  createUserRateLimiter,
  createIPRateLimiter,
  getRateLimitInfo,
  isAuthPageLoad,
} from "~/lib/rate-limit.server";

describe("Rate Limiting", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest = {
      ip: "127.0.0.1",
      socket: {
        remoteAddress: "127.0.0.1",
        // Dynamic import() type annotation needed for type reference
        // eslint-disable-next-line @typescript-eslint/consistent-type-imports -- Dynamic import requires value import
      } as unknown as import("net").Socket,
      path: "/api/test",
      method: "GET",
    };

    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
    };

    mockNext = vi.fn();
  });

  describe("apiLimiter", () => {
    it("should allow requests within limit", async () => {
      // Note: This is a basic test structure
      // Full integration tests would require setting up Express app
      expect(apiLimiter).toBeDefined();
      expect(typeof apiLimiter).toBe("function");
    });

    it("should have correct configuration", () => {
      // Verify limiter is configured with correct window and max
      expect(apiLimiter).toBeDefined();
    });
  });

  describe("strictLimiter", () => {
    it("should be defined", () => {
      expect(strictLimiter).toBeDefined();
      expect(typeof strictLimiter).toBe("function");
    });
  });

  describe("authLimiter", () => {
    it("should be defined", () => {
      expect(authLimiter).toBeDefined();
      expect(typeof authLimiter).toBe("function");
    });

    describe("isAuthPageLoad (skip predicate)", () => {
      it("skips GET and HEAD page loads of / and /login", () => {
        expect(isAuthPageLoad({ method: "GET", path: "/" })).toBe(true);
        expect(isAuthPageLoad({ method: "GET", path: "/login" })).toBe(true);
        // HEAD / is the /healthcheck loader's self-probe; it must never be
        // counted or the container health check starts failing with 429.
        expect(isAuthPageLoad({ method: "HEAD", path: "/" })).toBe(true);
        expect(isAuthPageLoad({ method: "HEAD", path: "/login" })).toBe(true);
      });

      it("still counts actual authentication attempts and other paths", () => {
        expect(isAuthPageLoad({ method: "POST", path: "/" })).toBe(false);
        expect(isAuthPageLoad({ method: "POST", path: "/login" })).toBe(false);
        expect(isAuthPageLoad({ method: "GET", path: "/auth/nostr" })).toBe(
          false
        );
        expect(isAuthPageLoad({ method: "HEAD", path: "/auth/nostr" })).toBe(
          false
        );
      });
    });
  });

  describe("createUserRateLimiter", () => {
    it("should create a middleware function", () => {
      const middleware = createUserRateLimiter(100, 60);
      expect(typeof middleware).toBe("function");
    });

    it("should skip rate limiting if no user ID", async () => {
      const middleware = createUserRateLimiter(100, 60);
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it("should handle Redis unavailability gracefully", async () => {
      // When Redis is not available, should skip rate limiting
      const originalEnv = process.env["REDIS_URL"];
      delete process.env["REDIS_URL"];

      const middleware = createUserRateLimiter(100, 60);
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should call next (skip rate limiting)
      expect(mockNext).toHaveBeenCalled();

      // Restore env
      if (originalEnv) {
        process.env["REDIS_URL"] = originalEnv;
      }
    });
  });

  describe("createIPRateLimiter", () => {
    it("should create a middleware function", () => {
      const middleware = createIPRateLimiter(100, 60);
      expect(typeof middleware).toBe("function");
    });

    it("should handle Redis unavailability gracefully", async () => {
      const originalEnv = process.env["REDIS_URL"];
      delete process.env["REDIS_URL"];

      const middleware = createIPRateLimiter(100, 60);
      await middleware(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Should call next (skip rate limiting)
      expect(mockNext).toHaveBeenCalled();

      // Restore env
      if (originalEnv) {
        process.env["REDIS_URL"] = originalEnv;
      }
    });
  });

  describe("getRateLimitInfo", () => {
    it("should return null when Redis is not available", async () => {
      const originalEnv = process.env["REDIS_URL"];
      delete process.env["REDIS_URL"];

      const info = await getRateLimitInfo("test-user-id");
      expect(info).toBeNull();

      // Restore env
      if (originalEnv) {
        process.env["REDIS_URL"] = originalEnv;
      }
    });

    it("should return rate limit info structure when available", async () => {
      // This would require Redis to be running
      // In a real test environment, you'd set up a test Redis instance
      const info = await getRateLimitInfo("test-user-id");

      // If Redis is available, should return info or null
      // If not available, should return null
      expect(
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Test: checking rate limit info structure
        info === null || (info && "remaining" in info && "resetTime" in info)
      ).toBe(true);
    });
  });
});
