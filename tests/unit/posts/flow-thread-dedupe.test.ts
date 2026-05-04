import { describe, it, expect } from "vitest";

import type { CombinedContent } from "~/features/posts/types";
import { dedupeFlowItemsByThreadGroup } from "~/features/posts/utils/flow-thread-dedupe";

const emptyOriginal = {};
const postOriginal: CombinedContent["originalData"] =
  emptyOriginal as CombinedContent["originalData"];

describe("dedupeFlowItemsByThreadGroup", () => {
  it("keeps the first post per threadGroupId in chronological order", () => {
    const a = {
      id: "1",
      type: "post" as const,
      threadGroupId: "g",
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      originalData: postOriginal,
    };
    const b = {
      ...a,
      id: "2",
    };
    const out = dedupeFlowItemsByThreadGroup([a, b]);
    expect(out.map((x) => x.id)).toEqual(["1"]);
  });

  it("does not merge posts without threadGroupId", () => {
    const a = {
      id: "1",
      type: "post" as const,
      threadGroupId: undefined,
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      originalData: postOriginal,
    };
    const b = { ...a, id: "2" };
    expect(dedupeFlowItemsByThreadGroup([a, b])).toHaveLength(2);
  });

  it("passes through longform items", () => {
    const lf = {
      id: "lf1",
      type: "longform" as const,
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      originalData: postOriginal,
    };
    expect(dedupeFlowItemsByThreadGroup([lf])).toEqual([lf]);
  });
});
