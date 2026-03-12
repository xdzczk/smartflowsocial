/**
 * Unit tests for CSRF protection middleware
 * Tests app/lib/csrf.ts
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock security.server
vi.mock("~/lib/security.server", () => {
  class CSRFValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "CSRFValidationError";
    }
  }

  return {
    isStateChangingMethod: vi.fn((method: string) =>
      ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase())
    ),
    validateOrigin: vi.fn(),
    CSRFValidationError,
  };
});

import { withCSRFProtection } from "~/lib/csrf";
import { validateOrigin, CSRFValidationError } from "~/lib/security.server";

describe("CSRF Protection Middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window mock
    (global as unknown as { window?: undefined }).window = undefined;
  });

  describe("withCSRFProtection", () => {
    it("should throw when withCSRFProtection is called on the client (window defined)", async () => {
      (global as unknown as { window: unknown }).window = {};
      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);
      const request = new Request("http://localhost:3000/test", {
        method: "POST",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      await expect(protectedAction(args)).rejects.toThrow(
        "withCSRFProtection should never be called on the client"
      );
    });

    it("should allow non-state-changing methods without validation", async () => {
      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "GET",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const result = await protectedAction(args);

      expect(validateOrigin).not.toHaveBeenCalled();
      expect(actionFn).toHaveBeenCalledWith(args);
      expect(result).toEqual({ success: true });
    });

    it("should validate origin for POST requests", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        // Validation passes
      });

      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "POST",
        headers: {
          Origin: "http://localhost:3000",
        },
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const result = await protectedAction(args);

      expect(validateOrigin).toHaveBeenCalledWith(request);
      expect(actionFn).toHaveBeenCalledWith(args);
      expect(result).toEqual({ success: true });
    });

    it("should validate origin for PUT requests", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        // Validation passes
      });

      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "PUT",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      await protectedAction(args);

      expect(validateOrigin).toHaveBeenCalledWith(request);
    });

    it("should validate origin for PATCH requests", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        // Validation passes
      });

      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "PATCH",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      await protectedAction(args);

      expect(validateOrigin).toHaveBeenCalledWith(request);
    });

    it("should validate origin for DELETE requests", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        // Validation passes
      });

      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "DELETE",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      await protectedAction(args);

      expect(validateOrigin).toHaveBeenCalledWith(request);
    });

    it("should return 403 response when CSRF validation fails", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        throw new CSRFValidationError("Invalid origin");
      });

      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "POST",
        headers: {
          Origin: "http://evil.com",
        },
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const result = await protectedAction(args);

      expect(validateOrigin).toHaveBeenCalledWith(request);
      expect(actionFn).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(403);
      const json = (await response.json()) as {
        error: string;
        message: string;
      };
      expect(json.error).toBe("CSRF validation failed");
      expect(json.message).toBe("Invalid origin");
    });

    it("should handle non-Error exceptions from validateOrigin", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        throw "String error";
      });

      const actionFn = vi.fn().mockResolvedValue({ success: true });
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "POST",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const result = await protectedAction(args);

      expect(result).toBeInstanceOf(Response);
      const response = result as Response;
      expect(response.status).toBe(403);
      const json = (await response.json()) as {
        error: string;
        message: string;
      };
      expect(json.error).toBe("CSRF validation failed");
      expect(json.message).toBe("Invalid origin");
    });

    it("should pass through action result", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        // Validation passes
      });

      const actionResult = { data: "test", status: 200 };
      const actionFn = vi.fn().mockResolvedValue(actionResult);
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "POST",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const result = await protectedAction(args);

      expect(result).toEqual(actionResult);
    });

    it("should handle action that returns Response", async () => {
      vi.mocked(validateOrigin).mockImplementation(() => {
        // Validation passes
      });

      const response = new Response("OK", { status: 200 });
      const actionFn = vi.fn().mockResolvedValue(response);
      const protectedAction = withCSRFProtection(actionFn);

      const request = new Request("http://localhost:3000/test", {
        method: "POST",
      });
      const args: ActionFunctionArgs = {
        request,
        params: {},
        context: {},
      };

      const result = await protectedAction(args);

      expect(result).toBe(response);
    });
  });
});
