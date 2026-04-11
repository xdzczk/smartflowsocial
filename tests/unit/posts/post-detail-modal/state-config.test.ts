import { describe, expect, it } from "vitest";

import { getPostDetailStateConfig } from "~/features/posts/components/post-detail-modal/state-config";

describe("getPostDetailStateConfig", () => {
  it("returns action-focused config for scheduled posts", () => {
    const config = getPostDetailStateConfig("scheduled");
    expect(config.sectionMode).toBe("actions");
    expect(config.headerPrefix).toBe("Scheduled for");
    expect(config.footer.primaryLabel).toBe("Edit post");
    expect(config.footer.secondaryLabel).toBe("Reschedule");
  });

  it("returns performance-focused config for published posts", () => {
    const config = getPostDetailStateConfig("published");
    expect(config.sectionMode).toBe("performance");
    expect(config.headerPrefix).toBe("Posted");
    expect(config.footer.primaryLabel).toBe("View thread");
    expect(config.footer.secondaryLabel).toBe("Open on Nostr");
  });

  it("returns draft defaults", () => {
    const config = getPostDetailStateConfig("draft");
    expect(config.sectionMode).toBe("actions");
    expect(config.headerPrefix).toBe("Created");
    expect(config.footer.primaryLabel).toBe("Edit draft");
  });
});
