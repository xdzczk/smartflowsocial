/**
 * Unit tests for file processing utilities
 * Tests app/features/posts/utils/file-processing.client.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock toast and client-side dependencies
vi.mock("react-hot-toast", () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock("~/lib/error-handler.client", () => ({
  logClientError: vi.fn(),
}));

import {
  isAcceptableFile,
  validateFileSizes,
  validateTotalSize,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  MAX_TOTAL_SIZE,
} from "~/features/posts/utils/file-processing.client";

// Helper to create a mock File object
function createMockFile(name: string, type: string, size: number): File {
  return {
    name,
    type,
    size,
    lastModified: Date.now(),
    webkitRelativePath: "",
    stream: vi.fn(),
    text: vi.fn(),
    arrayBuffer: vi.fn(),
    slice: vi.fn(),
  } as unknown as File;
}

describe("File Processing Utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isAcceptableFile", () => {
    it("should accept JPEG images", () => {
      const file = createMockFile("test.jpg", "image/jpeg", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept JPG images", () => {
      const file = createMockFile("test.jpg", "image/jpg", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept PNG images", () => {
      const file = createMockFile("test.png", "image/png", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept GIF images", () => {
      const file = createMockFile("test.gif", "image/gif", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept WebP images", () => {
      const file = createMockFile("test.webp", "image/webp", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept MP4 videos", () => {
      const file = createMockFile("test.mp4", "video/mp4", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept WebM videos", () => {
      const file = createMockFile("test.webm", "video/webm", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept OGG videos", () => {
      const file = createMockFile("test.ogg", "video/ogg", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should accept QuickTime videos", () => {
      const file = createMockFile("test.mov", "video/quicktime", 1000);
      expect(isAcceptableFile(file)).toBe(true);
    });

    it("should reject unsupported image types", () => {
      const file = createMockFile("test.bmp", "image/bmp", 1000);
      expect(isAcceptableFile(file)).toBe(false);
    });

    it("should reject unsupported video types", () => {
      const file = createMockFile("test.avi", "video/avi", 1000);
      expect(isAcceptableFile(file)).toBe(false);
    });

    it("should reject non-media files", () => {
      const file = createMockFile("test.pdf", "application/pdf", 1000);
      expect(isAcceptableFile(file)).toBe(false);
    });
  });

  describe("validateFileSizes", () => {
    it("should return empty array for files within limits", () => {
      const files = [
        createMockFile("image.jpg", "image/jpeg", 5 * 1024 * 1024), // 5MB
        createMockFile("video.mp4", "video/mp4", 50 * 1024 * 1024), // 50MB
      ];

      const errors = validateFileSizes(files);
      expect(errors).toEqual([]);
    });

    it("should return error for oversized images", () => {
      const files = [
        createMockFile("large.jpg", "image/jpeg", 11 * 1024 * 1024), // 11MB > 10MB limit
      ];

      const errors = validateFileSizes(files);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("large.jpg");
      expect(errors[0]).toContain("10MB");
    });

    it("should return error for oversized videos", () => {
      const files = [
        createMockFile("large.mp4", "video/mp4", 101 * 1024 * 1024), // 101MB > 100MB limit
      ];

      const errors = validateFileSizes(files);
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("large.mp4");
      expect(errors[0]).toContain("100MB");
    });

    it("should return errors for multiple oversized files", () => {
      const files = [
        createMockFile("large1.jpg", "image/jpeg", 11 * 1024 * 1024),
        createMockFile("large2.jpg", "image/jpeg", 12 * 1024 * 1024),
      ];

      const errors = validateFileSizes(files);
      expect(errors).toHaveLength(2);
    });

    it("should handle files at exact size limit", () => {
      const files = [
        createMockFile("image.jpg", "image/jpeg", MAX_IMAGE_SIZE),
        createMockFile("video.mp4", "video/mp4", MAX_VIDEO_SIZE),
      ];

      const errors = validateFileSizes(files);
      expect(errors).toEqual([]);
    });

    it("should handle empty file array", () => {
      const errors = validateFileSizes([]);
      expect(errors).toEqual([]);
    });
  });

  describe("validateTotalSize", () => {
    it("should return true for files within total size limit", () => {
      const files = [
        createMockFile("file1.jpg", "image/jpeg", 30 * 1024 * 1024),
        createMockFile("file2.jpg", "image/jpeg", 30 * 1024 * 1024),
        createMockFile("file3.jpg", "image/jpeg", 30 * 1024 * 1024),
      ];

      expect(validateTotalSize(files)).toBe(true);
    });

    it("should return false for files exceeding total size limit", () => {
      const files = [
        createMockFile("file1.jpg", "image/jpeg", 50 * 1024 * 1024),
        createMockFile("file2.jpg", "image/jpeg", 51 * 1024 * 1024), // Total: 101MB > 100MB
      ];

      expect(validateTotalSize(files)).toBe(false);
    });

    it("should return true for files at exact total size limit", () => {
      const files = [createMockFile("file1.jpg", "image/jpeg", MAX_TOTAL_SIZE)];

      expect(validateTotalSize(files)).toBe(true);
    });

    it("should return true for empty file array", () => {
      expect(validateTotalSize([])).toBe(true);
    });

    it("should handle single file at limit", () => {
      const files = [createMockFile("file1.jpg", "image/jpeg", MAX_TOTAL_SIZE)];

      expect(validateTotalSize(files)).toBe(true);
    });
  });
});





