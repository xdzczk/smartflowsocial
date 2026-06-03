import { describe, expect, it } from "vitest";

import {
  getQueueMetadataChips,
  getQueuePrimaryScheduleLine,
} from "~/features/posts/components/queue-type-summary";
import type { QueueType } from "~/features/posts/types";

function baseQueue(
  overrides: Partial<QueueType> & {
    scheduleConfig?: QueueType["scheduleConfig"];
  }
): QueueType {
  return {
    id: "q1",
    name: "Test",
    scheduleType: "INTERVAL",
    isEnabled: true,
    includeHashtagsInNoteBody: true,
    ...overrides,
  };
}

describe("getQueuePrimaryScheduleLine", () => {
  it("formats custom interval hours", () => {
    const line = getQueuePrimaryScheduleLine(
      baseQueue({
        scheduleType: "INTERVAL",
        scheduleConfig: { intervalHours: 8, useGlobalInterval: false },
      }),
      []
    );
    expect(line).toContain("Interval");
    expect(line).toContain("8");
  });

  it("formats global interval with user picks", () => {
    const line = getQueuePrimaryScheduleLine(
      baseQueue({
        scheduleType: "INTERVAL",
        scheduleConfig: { useGlobalInterval: true },
      }),
      [1, 8]
    );
    expect(line).toContain("Interval");
    expect(line).toMatch(/1|8/);
  });
});

describe("getQueueMetadataChips", () => {
  it("caps chips", () => {
    const chips = getQueueMetadataChips(
      baseQueue({
        isEnabled: false,
        hashTagPreset: { id: "p1", name: "P", tags: "#a #b" },
        includeHashtagsInNoteBody: false,
        scheduleType: "INTERVAL",
        scheduleConfig: {
          useGlobalInterval: true,
          scheduleRandomWindowMinutes: 15,
        },
      }),
      4
    );
    expect(chips.length).toBeLessThanOrEqual(4);
  });
});
