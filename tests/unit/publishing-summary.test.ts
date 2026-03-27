import { describe, expect, it } from "vitest";

import {
  buildArticleContentLines,
  buildDeliveryLines,
  buildPublishPathLines,
  buildPublishingOutcomeSentence,
  formatPostStatusSummaryInline,
  getReadinessLabel,
  getReadinessPresentation,
} from "~/features/posts/composer/components/composer/publishing-summary";

describe("publishing summary helpers", () => {
  it("returns readiness labels based on blockers and mode", () => {
    expect(getReadinessLabel("now", [], true)).toBe("Ready to publish");
    expect(getReadinessLabel("schedule", ["Missing content"], true)).toBe(
      "1 issue to fix"
    );
    expect(getReadinessLabel("queue", [], false)).toBe("Signer not connected");
  });

  it("returns readiness presentation tone", () => {
    expect(getReadinessPresentation("now", [], true).tone).toBe("ok");
    expect(getReadinessPresentation("now", ["x"], true).tone).toBe("block");
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
    expect(lines[1]).toContain("Next slot");
  });

  it("builds article content and publish path lines", () => {
    expect(buildArticleContentLines(true, 120, false, 2)).toEqual([
      "title set · 120 words · cover missing · 2 assets",
    ]);
    expect(buildPublishPathLines(2, "NIP-07", "Main Queue")[2]).toContain(
      "Queue: Main Queue"
    );
  });

  it("buildPublishingOutcomeSentence covers now, schedule, queue", () => {
    expect(
      buildPublishingOutcomeSentence({
        publishMode: "now",
        relayCount: 3,
        signerReady: true,
        scheduledFor: "",
        hasScheduleTime: false,
        selectedQueue: "unassigned",
      })
    ).toContain("3 relays");

    expect(
      buildPublishingOutcomeSentence({
        publishMode: "schedule",
        relayCount: 2,
        signerReady: true,
        scheduledFor: "2099-01-01T12:00",
        hasScheduleTime: true,
        selectedQueue: "unassigned",
      })
    ).toContain("Will publish on");

    expect(
      buildPublishingOutcomeSentence({
        publishMode: "queue",
        relayCount: 1,
        signerReady: true,
        scheduledFor: "",
        hasScheduleTime: false,
        selectedQueue: "unassigned",
      })
    ).toBe("Choose a queue to continue.");

    expect(
      buildPublishingOutcomeSentence({
        publishMode: "queue",
        relayCount: 1,
        signerReady: true,
        scheduledFor: "",
        hasScheduleTime: false,
        selectedQueue: "Morning",
        queueNextSlotLabel: "Today 09:00",
      })
    ).toContain("Morning");
  });

  it("formatPostStatusSummaryInline matches rail spec shape", () => {
    expect(formatPostStatusSummaryInline(10, 2, "a b", true)).toBe(
      "10 chars · 2 media · 2 tags · Recyclable"
    );
    expect(formatPostStatusSummaryInline(0, 0, "", false)).toBe(
      "0 chars · 0 media · 0 tags"
    );
  });
});
