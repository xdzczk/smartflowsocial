import { describe, expect, it } from "vitest";

import { getFlowGoLiveAtMs } from "~/features/posts/flow-go-live-at";
import type { CombinedContent } from "~/features/posts/types";

describe("getFlowGoLiveAtMs", () => {
  it("uses scheduledAtUtc for SCHEDULED even when publishedAt is set in the past", () => {
    const future = new Date("2026-04-01T12:00:00.000Z").getTime();
    const stalePast = new Date("2025-01-01T00:00:00.000Z").getTime();
    const item = {
      id: "1",
      type: "post",
      currentState: "SCHEDULED",
      scheduledAtUtc: new Date(future),
      publishedAt: new Date(stalePast),
    } as unknown as CombinedContent;

    expect(getFlowGoLiveAtMs(item)).toBe(future);
  });

  it("uses publishedAt for PUBLISHED when present", () => {
    const pub = new Date("2026-03-01T10:00:00.000Z").getTime();
    const item = {
      id: "2",
      type: "post",
      currentState: "PUBLISHED",
      scheduledAtUtc: new Date("2026-04-01T12:00:00.000Z"),
      publishedAt: new Date(pub),
    } as unknown as CombinedContent;

    expect(getFlowGoLiveAtMs(item)).toBe(pub);
  });
});
