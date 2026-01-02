/**
 * Unit tests for Remix utility functions
 * Tests functions in app/lib/remix-utils.ts
 */

import { describe, it, expect } from "vitest";

import { safeRedirect } from "~/lib/remix-utils";

describe("Remix Utils", () => {
  describe("safeRedirect", () => {
    it("should return default redirect for null", () => {
      expect(safeRedirect(null)).toBe("/");
    });

    it("should return default redirect for undefined", () => {
      expect(safeRedirect(undefined)).toBe("/");
    });

    it("should return default redirect for non-string", () => {
      expect(safeRedirect(123 as unknown as string)).toBe("/");
      expect(safeRedirect({} as unknown as string)).toBe("/");
    });

    it("should return path for valid relative path", () => {
      expect(safeRedirect("/dashboard")).toBe("/dashboard");
      expect(safeRedirect("/posts/123")).toBe("/posts/123");
    });

    it("should return default for path starting with //", () => {
      expect(safeRedirect("//evil.com")).toBe("/");
      expect(safeRedirect("//example.com/path")).toBe("/");
    });

    it("should return default for absolute URL", () => {
      expect(safeRedirect("http://example.com")).toBe("/");
      expect(safeRedirect("https://evil.com")).toBe("/");
    });

    it("should return default for protocol-relative URL", () => {
      expect(safeRedirect("//example.com")).toBe("/");
    });

    it("should use custom default redirect", () => {
      expect(safeRedirect(null, "/custom")).toBe("/custom");
      expect(safeRedirect(undefined, "/custom")).toBe("/custom");
    });

    it("should handle empty string", () => {
      expect(safeRedirect("")).toBe("/");
    });

    it("should handle root path", () => {
      expect(safeRedirect("/")).toBe("/");
    });

    it("should handle paths with query strings", () => {
      expect(safeRedirect("/dashboard?tab=posts")).toBe("/dashboard?tab=posts");
    });

    it("should handle paths with hash", () => {
      expect(safeRedirect("/dashboard#section")).toBe("/dashboard#section");
    });
  });

  // Note: useMatchesData, useOptionalUser, and useUser are React hooks
  // that require React context. They should be tested with React Testing Library
  // in integration tests or component tests, not unit tests.
});

