/**
 * Unit tests for bulk-post-events.utils (Phase 1.1): getFileUrlFromFetcher,
 * buildContent, convertTagsToArray, convertScheduledTime, parseOriginalFileUrl,
 * getFileUrlArray, createFakeFileUrlData, getUserTimezone, getDisplayFileUrl,
 * buildUploadFormData, showValidationErrorToast.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BulkPost } from "~/features/posts/types";
import {
  buildContent,
  buildUploadFormData,
  convertScheduledTime,
  convertTagsToArray,
  createFakeFileUrlData,
  getDisplayFileUrl,
  getFileUrlArray,
  getFileUrlFromFetcher,
  getUserTimezone,
  parseOriginalFileUrl,
  showValidationErrorToast,
} from "~/features/posts/utils/bulk-post-events.utils";

const minimalBulkPost = (overrides: Partial<BulkPost> = {}): BulkPost => ({
  clientId: "c1",
  files: [],
  caption: "",
  queueType: "",
  scheduledFor: "",
  isRecyclable: false,
  ...overrides,
});

describe("bulk-post-events.utils", () => {
  describe("getFileUrlFromFetcher", () => {
    it("returns empty fileUrl and scheduledFor for null or non-object", () => {
      expect(getFileUrlFromFetcher(null, 0)).toEqual({
        fileUrl: [],
        scheduledFor: "",
      });
      expect(getFileUrlFromFetcher(undefined, 0)).toEqual({
        fileUrl: [],
        scheduledFor: "",
      });
      expect(getFileUrlFromFetcher("string", 0)).toEqual({
        fileUrl: [],
        scheduledFor: "",
      });
    });

    it("returns fileUrl array and scheduledFor from fileUrls item", () => {
      const data = {
        fileUrls: [
          { fileUrl: ["https://a.com"], scheduledFor: "2024-06-01T12:00" },
          { fileUrl: "https://b.com", scheduledFor: "2024-06-02T14:00" },
        ],
      };
      expect(getFileUrlFromFetcher(data, 0)).toEqual({
        fileUrl: ["https://a.com"],
        scheduledFor: "2024-06-01T12:00",
      });
      expect(getFileUrlFromFetcher(data, 1)).toEqual({
        fileUrl: ["https://b.com"],
        scheduledFor: "2024-06-02T14:00",
      });
    });

    it("filters non-string entries from fileUrl array", () => {
      const data = {
        fileUrls: [
          {
            fileUrl: ["https://a.com", 123, null, "https://b.com"],
            scheduledFor: "",
          },
        ],
      };
      expect(getFileUrlFromFetcher(data, 0).fileUrl).toEqual([
        "https://a.com",
        "https://b.com",
      ]);
    });

    it("returns empty for out-of-range index", () => {
      const data = { fileUrls: [{ fileUrl: [], scheduledFor: "" }] };
      expect(getFileUrlFromFetcher(data, 5)).toEqual({
        fileUrl: [],
        scheduledFor: "",
      });
    });
  });

  describe("buildContent", () => {
    it("joins media, caption, and tags when includeHashtagsInNoteBody is true", () => {
      const out = buildContent(
        ["https://img.com"],
        "My caption",
        "#tag1 #tag2",
        true
      );
      expect(out).toContain("https://img.com");
      expect(out).toContain("My caption");
      expect(out).toContain("#tag1 #tag2");
    });

    it("omits tags when includeHashtagsInNoteBody is false", () => {
      const out = buildContent([], "Caption", "#tag", false);
      expect(out).toBe("Caption");
      expect(out).not.toContain("#tag");
    });

    it("joins only non-empty parts", () => {
      expect(buildContent([], "", "", false)).toBe("");
      expect(buildContent(["u1", "u2"], "cap", "", false)).toBe("u1\nu2\ncap");
    });
  });

  describe("convertTagsToArray", () => {
    it("returns empty for undefined or empty string", () => {
      expect(convertTagsToArray(undefined)).toEqual([]);
      expect(convertTagsToArray("")).toEqual([]);
    });

    it("splits by space and maps to [t, tag] without leading #", () => {
      expect(convertTagsToArray("#foo #bar")).toEqual([
        ["t", "foo"],
        ["t", "bar"],
      ]);
      expect(convertTagsToArray("foo bar")).toEqual([
        ["t", "foo"],
        ["t", "bar"],
      ]);
    });

    it("filters empty tags", () => {
      expect(convertTagsToArray("  #a   #b  ")).toEqual([
        ["t", "a"],
        ["t", "b"],
      ]);
    });
  });

  describe("convertScheduledTime", () => {
    it("parses datetime-local and returns ms", () => {
      const ms = convertScheduledTime("2024-06-15T14:30", "UTC");
      expect(typeof ms).toBe("number");
      expect(ms).toBeGreaterThan(0);
      const date = new Date(ms);
      expect(date.getUTCFullYear()).toBe(2024);
      expect(date.getUTCMonth()).toBe(5);
      expect(date.getUTCDate()).toBe(15);
      expect(date.getUTCHours()).toBe(14);
      expect(date.getUTCMinutes()).toBe(30);
    });

    it("handles ISO-like string in fallback (no trailing Z)", () => {
      const ms = convertScheduledTime("2024-06-15T14:30:00.000", "UTC");
      expect(typeof ms).toBe("number");
      expect(ms).toBeGreaterThan(0);
    });
  });

  describe("parseOriginalFileUrl", () => {
    it("returns first element for array", () => {
      expect(parseOriginalFileUrl(["a", "b"])).toBe("a");
      expect(parseOriginalFileUrl([])).toBe("");
    });

    it("parses JSON array string and returns first", () => {
      expect(parseOriginalFileUrl('["url1","url2"]')).toBe("url1");
    });

    it("returns original string when not JSON array", () => {
      expect(parseOriginalFileUrl("https://single.com")).toBe(
        "https://single.com"
      );
    });

    it("returns original on parse error", () => {
      expect(parseOriginalFileUrl("[invalid")).toBe("[invalid");
    });
  });

  describe("getFileUrlArray", () => {
    it("returns fileUrl array when post has fileUrl array", () => {
      const post = minimalBulkPost({
        fileUrl: ["a", "b"],
        isKind6Repost: false,
      });
      expect(getFileUrlArray(post)).toEqual(["a", "b"]);
    });

    it("returns [url] when post has fileUrl string", () => {
      const post = minimalBulkPost({
        fileUrl: "https://x.com",
        isKind6Repost: false,
      });
      expect(getFileUrlArray(post)).toEqual(["https://x.com"]);
    });

    it("returns from originalFileUrl for isKind6Repost", () => {
      const post = minimalBulkPost({
        isKind6Repost: true,
        originalFileUrl: ["https://orig.com"],
      });
      expect(getFileUrlArray(post)).toEqual(["https://orig.com"]);
    });

    it("returns empty for missing fileUrl", () => {
      const post = minimalBulkPost({ isKind6Repost: false });
      expect(getFileUrlArray(post)).toEqual([]);
    });
  });

  describe("createFakeFileUrlData", () => {
    it("maps posts to fileUrl, scheduledFor, queueType, isRecyclable", () => {
      const post = minimalBulkPost({
        queueType: "Q1",
        scheduledFor: "2024-06-01T12:00",
        isRecyclable: true,
        fileUrl: ["u1"],
      });
      const posts: BulkPost[] = [post];
      const out = createFakeFileUrlData(posts);
      expect(out).toHaveLength(1);
      expect(out[0]).toEqual({
        fileUrl: ["u1"],
        scheduledFor: "2024-06-01T12:00",
        queueType: "Q1",
        isRecyclable: true,
      });
    });
  });

  describe("getUserTimezone", () => {
    it("returns user timezone when present", () => {
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal user fixture for test */
      const user = { timezone: "America/New_York" } as Parameters<
        typeof getUserTimezone
      >[0];
      expect(getUserTimezone(user)).toBe("America/New_York");
    });

    it("returns UTC when user is null or missing timezone", () => {
      expect(getUserTimezone(null)).toBe("UTC");
      /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- minimal user fixture for test */
      const user = {} as Parameters<typeof getUserTimezone>[0];
      expect(getUserTimezone(user)).toBe("UTC");
    });
  });

  describe("getDisplayFileUrl", () => {
    it("returns empty when no originalFileUrl", () => {
      const post = minimalBulkPost({ originalFileUrl: undefined });
      expect(getDisplayFileUrl(post)).toBe("");
    });

    it("returns first from JSON array string", () => {
      const post = minimalBulkPost({
        originalFileUrl: '["https://first.com","second"]',
      });
      expect(getDisplayFileUrl(post)).toBe("https://first.com");
    });

    it("returns first from array", () => {
      const post = minimalBulkPost({ originalFileUrl: ["a", "b"] });
      expect(getDisplayFileUrl(post)).toBe("a");
    });

    it("returns string as-is when not array", () => {
      const post = minimalBulkPost({ originalFileUrl: "https://single.com" });
      expect(getDisplayFileUrl(post)).toBe("https://single.com");
    });
  });

  describe("buildUploadFormData", () => {
    it("appends fileUrls, scheduledDates, queueTypes, isRecyclable, _action", () => {
      const post = minimalBulkPost({
        queueType: "Main",
        scheduledFor: "2024-06-01T12:00",
        isRecyclable: false,
      });
      const posts: BulkPost[] = [post];
      const formData = buildUploadFormData(posts, [["url1"]]);
      expect(formData.get("fileUrls")).toBe(JSON.stringify([["url1"]]));
      expect(formData.get("scheduledDates")).toBe("2024-06-01T12:00");
      expect(formData.get("queueTypes")).toBe("Main");
      expect(formData.get("isRecyclable")).toBe("false");
      expect(formData.get("_action")).toBe("_upload_images_preview");
    });

    it("appends extraFormData when provided", () => {
      const post = minimalBulkPost({
        queueType: "Q",
        scheduledFor: "",
        isRecyclable: false,
      });
      const posts: BulkPost[] = [post];
      const formData = buildUploadFormData(posts, [[]], {
        customKey: "customValue",
      });
      expect(formData.get("customKey")).toBe("customValue");
    });
  });

  describe("showValidationErrorToast", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("calls setToast with error message for single error", () => {
      const setToast = vi.fn();
      showValidationErrorToast(["Invalid date"], setToast);
      expect(setToast).toHaveBeenCalledWith({
        type: "error",
        message: "Invalid date",
      });
    });

    it("calls setToast with combined message for multiple errors", () => {
      const setToast = vi.fn();
      showValidationErrorToast(["Error 1", "Error 2"], setToast);
      const twoIssuesMessage = expect.stringContaining("2 issues") as unknown;
      const error1Message = expect.stringContaining("Error 1") as unknown;
      expect(setToast).toHaveBeenCalledWith({
        type: "error",
        message: twoIssuesMessage,
      });
      expect(setToast).toHaveBeenCalledWith({
        type: "error",
        message: error1Message,
      });
    });

    it("schedules setToast(null) after 5s", () => {
      const setToast = vi.fn();
      showValidationErrorToast(["x"], setToast);
      setToast.mockClear();
      vi.advanceTimersByTime(5000);
      expect(setToast).toHaveBeenCalledWith(null);
    });
  });
});
