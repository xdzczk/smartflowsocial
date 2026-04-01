import { describe, expect, it } from "vitest";

import {
  buildPublishFallbackBody,
  buildPublishTemplateKey,
  buildPublishTitle,
  normalizePostKind,
  normalizeQueueName,
} from "~/infra/notifications/publish-copy.server";
import { BRAND_NAME } from "~/lib/brand";

describe("publish notification copy helpers", () => {
  it("treats QUOTE as a normal post title", () => {
    const title = buildPublishTitle({
      isLongForm: false,
      displayName: BRAND_NAME,
      postKind: "QUOTE",
    });

    expect(title).toBe(`Post published as ${BRAND_NAME}`);
  });

  it("adds queue context for scheduled post fallback copy", () => {
    const body = buildPublishFallbackBody({
      isLongForm: false,
      source: "scheduled",
      queueName: "Morning Queue",
      postKind: "REPOST",
    });

    expect(body).toContain("Your repost is now live on Nostr.");
    expect(body).toContain("Queue: Morning Queue.");
  });

  it("builds longform template keys without post flavor", () => {
    const templateKey = buildPublishTemplateKey({
      isLongForm: true,
      source: "scheduled",
      postKind: "POST",
    });

    expect(templateKey).toBe("publish_success_article_scheduled");
  });

  it("normalizes queue name and post kind defensively", () => {
    expect(normalizeQueueName("  Growth  ")).toBe("Growth");
    expect(normalizeQueueName("   ")).toBeNull();
    expect(normalizePostKind("unexpected")).toBe("POST");
  });
});
