/**
 * Unit tests for publish result utilities
 * Tests app/features/posts/utils/publish-result.utils.ts
 */

import { describe, it, expect } from "vitest";

import {
  getPostTypeFromPost,
  getNewPostUrl,
  determineModalAction,
  formatRelayUrl,
} from "~/features/posts/utils/publish-result.utils";

describe("Publish Result Utils", () => {
  describe("getPostTypeFromPost", () => {
    it("returns longform when longFormPost is provided", () => {
      expect(getPostTypeFromPost({ id: "1" }, { id: "lf1" })).toBe("longform");
    });
    it("returns post when only post is provided", () => {
      expect(getPostTypeFromPost({ id: "1" }, null)).toBe("post");
    });
    it("returns post when neither is provided", () => {
      expect(getPostTypeFromPost(null, null)).toBe("post");
    });
    it("prefers longform when both provided", () => {
      expect(getPostTypeFromPost({ id: "1" }, { id: "lf1" })).toBe("longform");
    });
  });

  describe("getNewPostUrl", () => {
    it("returns article type route for longform", () => {
      expect(getNewPostUrl("longform")).toBe("/dashboard/compose?type=article");
    });
    it("returns post type route for post", () => {
      expect(getNewPostUrl("post")).toBe("/dashboard/compose?type=post");
    });
  });

  describe("determineModalAction", () => {
    it("returns publish when currentState is PUBLISHED", () => {
      expect(determineModalAction({ currentState: "PUBLISHED" }, null)).toBe(
        "publish"
      );
      expect(determineModalAction(null, { currentState: "PUBLISHED" })).toBe(
        "publish"
      );
    });
    it("returns schedule when currentState is SCHEDULED", () => {
      expect(determineModalAction({ currentState: "SCHEDULED" }, null)).toBe(
        "schedule"
      );
    });
    it("returns schedule by default", () => {
      expect(determineModalAction(null, null)).toBe("schedule");
      expect(determineModalAction({ currentState: "DRAFT" }, null)).toBe(
        "schedule"
      );
    });
  });

  describe("formatRelayUrl", () => {
    it("returns hostname for valid URL", () => {
      expect(formatRelayUrl("https://relay.example.com")).toBe(
        "relay.example.com"
      );
    });
    it("includes non-default port", () => {
      expect(formatRelayUrl("wss://relay.example.com:8080")).toBe(
        "relay.example.com:8080"
      );
    });
    it("omits port 443 for https", () => {
      expect(formatRelayUrl("https://relay.example.com:443")).toBe(
        "relay.example.com"
      );
    });
    it("handles invalid URL by returning truncated string when long", () => {
      const longInvalid = "not-a-url-" + "x".repeat(50);
      expect(formatRelayUrl(longInvalid)).toBe(
        longInvalid.slice(0, 47) + "..."
      );
    });
    it("returns as-is for short invalid URL", () => {
      expect(formatRelayUrl("short")).toBe("short");
    });
  });
});
