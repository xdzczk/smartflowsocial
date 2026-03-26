import { describe, expect, it } from "vitest";

import {
  buildArticleContentLines,
  buildDeliveryLines,
  buildPublishPathLines,
  getReadinessLabel,
} from "~/features/posts/composer/components/composer/publishing-summary";

describe("publishing summary helpers", () => {
  it("returns readiness labels based on blockers and mode", () => {
    expect(getReadinessLabel("now", [], true)).toBe("Ready to publish");
    expect(getReadinessLabel("schedule", ["Missing content"], true)).toContain(
      "Needs attention"
    );
    expect(getReadinessLabel("queue", [], false)).toBe(
      "Waiting for signer connection"
    );
  });

  it("builds queue delivery lines", () => {
    const lines = buildDeliveryLines({
      publishMode: "queue",
      relayCount: 3,
      signerLabel: "NIP-07",
      selectedQueue: "Test Queue",
      nextSlot: "Today 20:00",
    });
    expect(lines[0]).toContain("Queue: Test Queue");
    expect(lines[1]).toContain("Today 20:00");
  });

  it("builds article content and publish path lines", () => {
    expect(buildArticleContentLines(true, 120, false, 2)).toEqual([
      "Title: Present",
      "Word count: 120",
      "Cover: Missing",
      "Embedded assets: 2",
    ]);
    expect(buildPublishPathLines(2, "NIP-07", "Main Queue")[2]).toContain(
      "Main Queue"
    );
  });
});
