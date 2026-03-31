import { describe, expect, it } from "vitest";

import {
  bulkPostMissingRequiredCaption,
  hasMedia,
} from "~/features/posts/components/bulk-composer/bulk-composer-post-card-utils";
import type { BulkPost } from "~/features/posts/types";

function minimalPost(overrides: Partial<BulkPost> = {}): BulkPost {
  return {
    clientId: "c1",
    files: [],
    caption: "",
    queueType: "q",
    scheduledFor: "2099-01-01T12:00",
    isRecyclable: false,
    ...overrides,
  };
}

describe("bulkPostMissingRequiredCaption", () => {
  it("is false for kind 6 repost rows without caption or media", () => {
    expect(
      bulkPostMissingRequiredCaption(
        minimalPost({ isKind6Repost: true, caption: "", fileUrl: "" })
      )
    ).toBe(false);
  });

  it("is true for normal posts with no media and empty caption", () => {
    expect(
      bulkPostMissingRequiredCaption(minimalPost({ caption: "", fileUrl: "" }))
    ).toBe(true);
  });

  it("is false when caption is present", () => {
    expect(
      bulkPostMissingRequiredCaption(
        minimalPost({ caption: "hello", fileUrl: "" })
      )
    ).toBe(false);
  });

  it("is false when media is present", () => {
    expect(
      bulkPostMissingRequiredCaption(
        minimalPost({ caption: "", fileUrl: "https://x/y.jpg" })
      )
    ).toBe(false);
  });
});

describe("hasMedia", () => {
  it("treats kind 6 rows consistently with fileUrl", () => {
    const p = minimalPost({ isKind6Repost: true, fileUrl: "" });
    expect(hasMedia(p)).toBe(false);
  });
});
