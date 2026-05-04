import { describe, expect, it } from "vitest";

import { postToCombinedContent } from "~/features/posts/combined";
import {
  attachedCombinedByParentId,
  attachedCombinedForThreadRow,
} from "~/features/posts/utils/attached-follow-up-rows";

describe("attached-follow-up-rows", () => {
  it("attachedCombinedForThreadRow collects follow-ups keyed to root or any thread segment", () => {
    const early = {
      id: "seg-a",
      threadGroupId: "g1",
      caption: "first",
      scheduledAtUtc: new Date("2025-06-01T10:00:00Z"),
      userId: "u",
      createdAt: new Date(),
      updatedAt: new Date(),
      status: "SCHEDULED",
      currentState: "SCHEDULED",
      fileUrl: [],
    };
    const late = {
      ...early,
      id: "seg-b",
      caption: "second",
      scheduledAtUtc: new Date("2025-06-01T11:00:00Z"),
    };
    const followRoot = {
      ...early,
      id: "fu1",
      caption: "child of root",
      dependencyMode: "attached" as const,
      parentScheduledActionId: "seg-a",
      threadGroupId: null,
    };
    const followSegment = {
      ...early,
      id: "fu2",
      caption: "child of segment b",
      dependencyMode: "attached" as const,
      parentScheduledActionId: "seg-b",
      threadGroupId: null,
    };
    const combined = [late, early, followRoot, followSegment].map((p) =>
      postToCombinedContent(p as never)
    );
    const byParent = attachedCombinedByParentId(combined);
    const rowsEarlyRoot = {
      root: combined.find((c) => c.id === "seg-a")!,
      threadSegments: [combined.find((c) => c.id === "seg-b")!],
    };
    const merged = attachedCombinedForThreadRow(byParent, rowsEarlyRoot);
    expect(merged.map((c) => c.id).sort()).toEqual(["fu1", "fu2"]);
  });
});
