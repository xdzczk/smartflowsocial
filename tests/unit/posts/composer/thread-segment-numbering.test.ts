import { describe, expect, it } from "vitest";

import {
  applyThreadSegmentNumberingToSegments,
  stripLeadingThreadSegmentNumber,
} from "~/features/posts/composer/utils/thread-segment-numbering";

describe("thread-segment-numbering", () => {
  it("strips one leading index prefix", () => {
    expect(stripLeadingThreadSegmentNumber("1) hello")).toBe("hello");
    expect(stripLeadingThreadSegmentNumber("12)  x")).toBe("x");
    expect(stripLeadingThreadSegmentNumber("no prefix")).toBe("no prefix");
  });

  it("applies 1-based prefixes", () => {
    const out = applyThreadSegmentNumberingToSegments([
      { id: "a", content: "first" },
      { id: "b", content: "2) second" },
    ]);
    expect(out[0]?.content).toBe("1) first");
    expect(out[1]?.content).toBe("2) second");
  });

  it("preserves other fields", () => {
    const segment: { id: string; content: string; extra: number } = {
      id: "a",
      content: "x",
      extra: 1,
    };
    const out = applyThreadSegmentNumberingToSegments([segment]);
    expect(out[0]).toMatchObject({ id: "a", extra: 1, content: "1) x" });
  });
});
