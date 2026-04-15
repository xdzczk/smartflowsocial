import { describe, expect, it } from "vitest";

import {
  buildDraftDeepLink,
  buildQueueDeepLink,
  buildScheduledDeepLink,
} from "~/features/engagement/services/engagement-deep-links";
import { buildEngagementContentPreview } from "~/features/engagement/utils/engagement-content-preview";
import { richContentToPlainPreview } from "~/lib/html-to-plain-text";
import { absoluteUrl } from "~/lib/site-url";

describe("W1 utility coverage", () => {
  describe("absoluteUrl", () => {
    it("prefixes missing leading slash", () => {
      expect(absoluteUrl("https://smartflow.social", "dashboard")).toBe(
        "https://smartflow.social/dashboard"
      );
    });

    it("keeps existing leading slash", () => {
      expect(absoluteUrl("https://smartflow.social", "/dashboard")).toBe(
        "https://smartflow.social/dashboard"
      );
    });
  });

  describe("richContentToPlainPreview", () => {
    it("returns empty string for non-string values", () => {
      expect(richContentToPlainPreview("")).toBe("");
      expect(richContentToPlainPreview(null as unknown as string)).toBe("");
    });

    it("converts block tags and strips html safely", () => {
      const html =
        "<div>Hello<br/>world</div><p><strong>Second</strong> line</p><script>alert(1)</script>";
      expect(richContentToPlainPreview(html)).toBe(
        "Hello\nworld\n\nSecond line"
      );
    });

    it("collapses excessive blank lines", () => {
      const html = "<p>One</p><p></p><p></p><div>Two</div>";
      expect(richContentToPlainPreview(html)).toBe("One\n\nTwo");
    });
  });

  describe("engagement deep links", () => {
    it("encodes query values", () => {
      expect(buildDraftDeepLink("draft id/123")).toBe(
        "/dashboard/drafts?draftId=draft%20id%2F123"
      );
      expect(buildScheduledDeepLink("post id/123")).toBe(
        "/dashboard/scheduled?postId=post%20id%2F123"
      );
      expect(buildQueueDeepLink("queue id/123")).toBe(
        "/dashboard/scheduled?queueTypeId=queue%20id%2F123"
      );
    });
  });

  describe("buildEngagementContentPreview", () => {
    it("returns default variant without aggressive nostr stripping", () => {
      const content =
        "Check nostr:note1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq now";
      const result = buildEngagementContentPreview(content, "default");
      expect(result.noisy).toBe(false);
      expect(result.isTruncated).toBe(false);
      expect(result.text).toContain("nostr:note1");
    });

    it("aggressively strips nostr refs in mention variant", () => {
      const content = "Look nostr:nevent1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";
      const result = buildEngagementContentPreview(content, "mention");
      expect(result.text).toContain("…");
      expect(result.text).not.toContain("nostr:nevent1");
    });

    it("collapses long noisy token and truncates mention text", () => {
      const longToken = "a".repeat(90);
      const content = `${longToken} keep-this-word`;
      const result = buildEngagementContentPreview(content, "mention");
      expect(result.noisy).toBe(true);
      expect(result.text).toContain("keep-this-word");
    });

    it("truncates to variant max lengths", () => {
      const long = "x".repeat(400);
      const mention = buildEngagementContentPreview(long, "mention");
      const regular = buildEngagementContentPreview(long, "default");
      expect(mention.text.length).toBeLessThanOrEqual(221);
      expect(regular.text.length).toBeLessThanOrEqual(321);
      expect(mention.text.endsWith("…")).toBe(true);
      expect(regular.isTruncated).toBe(true);
    });
  });
});
