/**
 * Unit tests for media helper functions
 * Tests functions in app/utils/media-helpers.ts
 */

import { describe, it, expect } from "vitest";

import { isVideoFile, isVideoUrl, getPostType } from "~/utils/media-helpers";

describe("Media Helpers", () => {
  describe("isVideoFile", () => {
    it("should return false for null", () => {
      expect(isVideoFile(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isVideoFile(undefined)).toBe(false);
    });

    it("should return true for video MIME types", () => {
      const videoMimeTypes = [
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime",
        "video/avi",
        "video/x-msvideo",
        "video/mkv",
        "video/x-matroska",
        "video/3gpp",
        "video/x-flv",
      ];

      videoMimeTypes.forEach((mimeType) => {
        const file = new File([], "test", { type: mimeType });
        expect(isVideoFile(file)).toBe(true);
      });
    });

    it("should return true for video file extensions", () => {
      const videoExtensions = [
        "test.mp4",
        "test.webm",
        "test.ogg",
        "test.mov",
        "test.avi",
        "test.mkv",
        "test.m4v",
        "test.3gp",
        "test.flv",
      ];

      videoExtensions.forEach((filename) => {
        const file = new File([], filename, { type: "" });
        expect(isVideoFile(file)).toBe(true);
      });
    });

    it("should return false for image files", () => {
      const imageFile = new File([], "test.jpg", { type: "image/jpeg" });
      expect(isVideoFile(imageFile)).toBe(false);
    });

    it("should return false for files without extension or MIME type", () => {
      const file = new File([], "test", { type: "" });
      expect(isVideoFile(file)).toBe(false);
    });

    it("should handle case-insensitive extensions", () => {
      const file1 = new File([], "test.MP4", { type: "" });
      const file2 = new File([], "test.MoV", { type: "" });
      expect(isVideoFile(file1)).toBe(true);
      expect(isVideoFile(file2)).toBe(true);
    });
  });

  describe("isVideoUrl", () => {
    it("should return false for null", () => {
      expect(isVideoUrl(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isVideoUrl(undefined)).toBe(false);
    });

    it("should return true for URLs with video extensions", () => {
      const videoUrls = [
        "https://example.com/video.mp4",
        "https://example.com/video.webm",
        "https://example.com/video.ogg",
        "https://example.com/video.mov",
        "https://example.com/video.avi",
        "https://example.com/video.mkv",
        "https://example.com/video.m4v",
        "https://example.com/video.3gp",
        "https://example.com/video.flv",
      ];

      videoUrls.forEach((url) => {
        expect(isVideoUrl(url)).toBe(true);
      });
    });

    it("should return false for image URLs", () => {
      expect(isVideoUrl("https://example.com/image.jpg")).toBe(false);
      expect(isVideoUrl("https://example.com/image.png")).toBe(false);
    });

    it("should return false for URLs without extensions", () => {
      expect(isVideoUrl("https://example.com/video")).toBe(false);
    });

    it("should handle case-insensitive extensions", () => {
      expect(isVideoUrl("https://example.com/video.MP4")).toBe(true);
      expect(isVideoUrl("https://example.com/video.MoV")).toBe(true);
    });

    it("should detect video extension anywhere in URL", () => {
      expect(
        isVideoUrl("https://example.com/path/to/video.mp4?param=value"),
      ).toBe(true);
    });
  });

  describe("getPostType", () => {
    it("should return VIDEO for video file", () => {
      const videoFile = new File([], "test.mp4", { type: "video/mp4" });
      expect(getPostType(videoFile)).toBe("VIDEO");
    });

    it("should return VIDEO for video URL", () => {
      expect(getPostType(null, "https://example.com/video.mp4")).toBe("VIDEO");
    });

    it("should return IMAGE for image file", () => {
      const imageFile = new File([], "test.jpg", { type: "image/jpeg" });
      expect(getPostType(imageFile)).toBe("IMAGE");
    });

    it("should return IMAGE for image URL", () => {
      expect(getPostType(null, "https://example.com/image.jpg")).toBe("IMAGE");
    });

    it("should check file first, then URL", () => {
      // If file is video, return VIDEO regardless of URL
      const videoFile = new File([], "test.mp4", { type: "video/mp4" });
      expect(getPostType(videoFile, "https://example.com/image.jpg")).toBe(
        "VIDEO",
      );

      // If file is not video, check URL - if URL is video, return VIDEO
      const imageFile = new File([], "test.jpg", { type: "image/jpeg" });
      expect(getPostType(imageFile, "https://example.com/video.mp4")).toBe(
        "VIDEO",
      );

      // If file is not video and URL is not video, return IMAGE
      expect(getPostType(imageFile, "https://example.com/image.jpg")).toBe(
        "IMAGE",
      );
    });

    it("should return IMAGE when both are null", () => {
      expect(getPostType(null, null)).toBe("IMAGE");
    });

    it("should return IMAGE when both are undefined", () => {
      expect(getPostType(undefined, undefined)).toBe("IMAGE");
    });

    it("should return IMAGE for file without video extension or MIME type", () => {
      const file = new File([], "test", { type: "" });
      expect(getPostType(file)).toBe("IMAGE");
    });
  });
});
